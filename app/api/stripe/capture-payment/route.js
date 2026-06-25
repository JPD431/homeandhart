import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getBookingPrecioBase,
  getIngresoProveedorDesdeBase,
} from "@/app/lib/ingresos-proveedor";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STRIPE_MIN_TRANSFER_EUR = 0.5;

function getReservasSinComisionProveedor(profile) {
  if (profile?.reservas_sin_comision_proveedor != null) {
    return Number(profile.reservas_sin_comision_proveedor) || 0;
  }
  return Number(profile?.reservas_sin_comision) || 0;
}

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

function splitTransferAmount(amountFinal, bookings) {
  if (!bookings?.length) return [];

  if (bookings.length === 1) {
    return [{ bookingId: bookings[0].id, amount: amountFinal }];
  }

  const bases = bookings.map((b) => ({
    id: b.id,
    base: getBookingPrecioBase(b),
  }));
  const totalBase = bases.reduce((sum, b) => sum + b.base, 0);
  if (totalBase <= 0) {
    return bases.map((b) => ({ bookingId: b.id, amount: 0 }));
  }

  const parts = [];
  let assigned = 0;

  for (let i = 0; i < bases.length; i++) {
    if (i === bases.length - 1) {
      parts.push({
        bookingId: bases[i].id,
        amount: Math.round((amountFinal - assigned) * 100) / 100,
      });
    } else {
      const share =
        Math.round(((amountFinal * bases[i].base) / totalBase) * 100) / 100;
      parts.push({ bookingId: bases[i].id, amount: share });
      assigned += share;
    }
  }

  return parts;
}

async function isProviderFirstCompletion(proveedorId, paymentIntentId) {
  const { data: services } = await supabase
    .from("services")
    .select("id")
    .eq("proveedor_id", proveedorId);

  const serviceIds = (services ?? []).map((s) => s.id);
  if (serviceIds.length === 0) return false;

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("service_id", serviceIds)
    .eq("estado", "completada")
    .neq("payment_intent_id", paymentIntentId);

  return (count ?? 0) === 0;
}

async function rewardReferrerIfFirstCompletion(proveedorId, proveedorProfile, paymentIntentId) {
  if (!proveedorProfile?.referido_por) return;

  const isFirst = await isProviderFirstCompletion(proveedorId, paymentIntentId);
  if (!isFirst) return;

  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, reservas_sin_comision, referidos_count")
    .eq("codigo_referido", proveedorProfile.referido_por)
    .maybeSingle();

  if (!referrer) return;

  await supabase
    .from("profiles")
    .update({
      reservas_sin_comision: (Number(referrer.reservas_sin_comision) || 0) + 1,
      referidos_count: (Number(referrer.referidos_count) || 0) + 1,
    })
    .eq("id", referrer.id);
}

async function buildTransfersForPayment(paymentIntentId) {
  const empty = { plans: [], creditoGrupo: 0, grupoUsaCredito: false };

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      "id, service_id, precio_total, precio_base, cliente_sin_comision, credito_aplicado",
    )
    .eq("payment_intent_id", paymentIntentId);

  if (bookingsError || !bookings?.length) return empty;

  const creditoGrupo = bookings.reduce(
    (sum, b) => sum + (Number(b.credito_aplicado) || 0),
    0,
  );
  const creditoGrupoRounded = Math.round(creditoGrupo * 100) / 100;

  const serviceIds = [...new Set(bookings.map((b) => b.service_id).filter(Boolean))];
  if (serviceIds.length === 0) {
    return { ...empty, creditoGrupo: creditoGrupoRounded };
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select(
      `
      id,
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id,
        reservas_sin_comision_proveedor,
        reservas_sin_comision,
        referido_por,
        deuda_pendiente,
        saldo_pendiente_transferir
      )
    `,
    )
    .in("id", serviceIds);

  if (servicesError || !services?.length) {
    return { ...empty, creditoGrupo: creditoGrupoRounded };
  }

  const proveedorMap = new Map();

  for (const service of services) {
    const proveedorId = service.proveedor_id;
    const profile = service.profiles;
    if (!proveedorId || !profile?.stripe_account_id) continue;

    if (!proveedorMap.has(proveedorId)) {
      proveedorMap.set(proveedorId, {
        proveedorId,
        stripe_account_id: profile.stripe_account_id,
        reservas_sin_comision_proveedor: getReservasSinComisionProveedor(profile),
        referido_por: profile.referido_por,
        profile,
        serviceIds: new Set(),
        amount: 0,
        bookingIds: [],
        bookings: [],
      });
    }

    proveedorMap.get(proveedorId).serviceIds.add(service.id);
  }

  for (const booking of bookings) {
    for (const entry of proveedorMap.values()) {
      if (!entry.serviceIds.has(booking.service_id)) continue;
      entry.amount += getBookingPrecioBase(booking);
      entry.bookingIds.push(booking.id);
      entry.bookings.push(booking);
    }
  }

  const plans = [];

  for (const entry of proveedorMap.values()) {
    if (entry.amount <= 0) continue;

    const proveedorSinComision = entry.reservas_sin_comision_proveedor > 0;
    const amountBruto = getIngresoProveedorDesdeBase(entry.amount, {
      sinComision: proveedorSinComision,
    });
    plans.push({
      proveedorId: entry.proveedorId,
      stripe_account_id: entry.stripe_account_id,
      amount: amountBruto,
      amount_bruto: amountBruto,
      deuda_actual: Number(entry.profile?.deuda_pendiente) || 0,
      profile: entry.profile,
      proveedorSinComision,
      decrementSinComision: proveedorSinComision,
      bookingIds: entry.bookingIds,
      bookings: entry.bookings,
    });
  }

  return {
    plans,
    creditoGrupo: creditoGrupoRounded,
    grupoUsaCredito: creditoGrupoRounded > 0,
  };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const isInternalCall =
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const { paymentIntentId, bookingId, token } = await request.json();

    if (!isInternalCall) {
      if (
        !bookingId ||
        !token ||
        !verificarTokenConfirmacion(bookingId, token)
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let resolvedPaymentIntentId = paymentIntentId;

    if (!resolvedPaymentIntentId && bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("payment_intent_id")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking?.payment_intent_id) {
        return Response.json(
          { error: "No se encontró payment_intent_id para esta reserva" },
          { status: 400 },
        );
      }

      resolvedPaymentIntentId = booking.payment_intent_id;
    }

    if (!resolvedPaymentIntentId) {
      return Response.json(
        { error: "Falta paymentIntentId o bookingId" },
        { status: 400 },
      );
    }

    if (!isInternalCall && bookingId) {
      const { error: confirmError } = await supabase
        .from("bookings")
        .update({
          confirmacion_cliente: "ok",
          confirmado_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (confirmError) {
        return Response.json({ error: confirmError.message }, { status: 500 });
      }
    }

    const { data: existingBookings, error: existingBookingsError } =
      await supabase
        .from("bookings")
        .select("id, pago_liberado_at")
        .eq("payment_intent_id", resolvedPaymentIntentId);

    if (existingBookingsError) {
      return Response.json(
        { error: "No se pudo comprobar el estado del pago" },
        { status: 500 },
      );
    }

    if (
      existingBookings?.length > 0 &&
      existingBookings.every((b) => b.pago_liberado_at != null)
    ) {
      return Response.json({ success: true, already_processed: true });
    }

    const paymentIntent = await stripe.paymentIntents.capture(resolvedPaymentIntentId);
    const chargeId = paymentIntent.latest_charge;

    const {
      plans: transferPlan,
      creditoGrupo,
      grupoUsaCredito,
    } = await buildTransfersForPayment(resolvedPaymentIntentId);

    const preparedPlans = transferPlan.map((plan) => {
      const deuda_a_descontar = Math.min(plan.deuda_actual, plan.amount_bruto);
      const amount_este_ciclo = roundMoney(
        plan.amount_bruto - deuda_a_descontar,
      );
      const saldo_pendiente_anterior = roundMoney(
        plan.profile?.saldo_pendiente_transferir,
      );
      const total_a_transferir = roundMoney(
        saldo_pendiente_anterior + amount_este_ciclo,
      );
      return {
        ...plan,
        deuda_a_descontar,
        amount_este_ciclo,
        amount_final: amount_este_ciclo,
        saldo_pendiente_anterior,
        total_a_transferir,
        transfer_required: total_a_transferir >= STRIPE_MIN_TRANSFER_EUR,
      };
    });

    const totalTransferir = preparedPlans.reduce(
      (sum, plan) =>
        plan.transfer_required ? sum + plan.total_a_transferir : sum,
      0,
    );
    const totalTransferirRounded = roundMoney(totalTransferir);
    const capturadoNeto = Math.round(paymentIntent.amount) / 100;
    const usePlatformBalance =
      creditoGrupo > 0 || totalTransferirRounded > capturadoNeto;
    const financiamiento = usePlatformBalance ? "balance_plataforma" : "cargo";

    const transfers = [];
    const transferSummaries = [];
    const transferErrors = [];
    const bookingIdsLiberados = [];

    if (preparedPlans.length && chargeId) {
      for (const plan of preparedPlans) {
        const summary = {
          proveedorId: plan.proveedorId,
          amount_bruto: plan.amount_bruto,
          amount_este_ciclo: plan.amount_este_ciclo,
          amount_final: plan.amount_este_ciclo,
          saldo_pendiente_anterior: plan.saldo_pendiente_anterior,
          saldo_pendiente_nuevo: plan.saldo_pendiente_anterior,
          total_a_transferir: plan.total_a_transferir,
          transferido_stripe: 0,
          deuda_descontada: 0,
          amount_transferido: 0,
          deuda_restante: plan.deuda_actual,
          transfer_required: plan.transfer_required,
          financiamiento,
          success: false,
          skipped: false,
          error: null,
          booking_ids: plan.bookingIds,
        };

        const { data: bookingStates, error: bookingStatesError } =
          await supabase
            .from("bookings")
            .select("id, pago_liberado_at")
            .in("id", plan.bookingIds);

        if (bookingStatesError) {
          throw bookingStatesError;
        }

        const liberadosCount =
          bookingStates?.filter((b) => b.pago_liberado_at != null).length ?? 0;

        if (liberadosCount === plan.bookingIds.length) {
          summary.skipped = true;
          summary.success = true;
          transferSummaries.push(summary);
          continue;
        }

        if (liberadosCount > 0) {
          throw new Error(
            `Estado inconsistente: algunos bookings del proveedor ${plan.proveedorId} ya tienen pago_liberado_at`,
          );
        }

        try {
          let saldo_pendiente_nuevo = plan.saldo_pendiente_anterior;

          if (plan.transfer_required) {
            const transferParams = {
              amount: Math.round(plan.total_a_transferir * 100),
              currency: "eur",
              destination: plan.stripe_account_id,
            };

            if (!usePlatformBalance) {
              transferParams.source_transaction = chargeId;
            }

            const transfer = await stripe.transfers.create(transferParams);
            transfers.push(transfer);
            summary.amount_transferido = plan.total_a_transferir;
            summary.transferido_stripe = plan.total_a_transferir;
            saldo_pendiente_nuevo = 0;
          } else if (plan.total_a_transferir > 0) {
            saldo_pendiente_nuevo = plan.total_a_transferir;
          }

          const deuda_restante = Math.max(
            0,
            plan.deuda_actual - plan.deuda_a_descontar,
          );
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              deuda_pendiente: deuda_restante,
              saldo_pendiente_transferir: saldo_pendiente_nuevo,
            })
            .eq("id", plan.proveedorId);

          if (profileError) {
            throw profileError;
          }

          summary.deuda_descontada = plan.deuda_a_descontar;
          summary.deuda_restante = deuda_restante;
          summary.saldo_pendiente_nuevo = saldo_pendiente_nuevo;

          try {
            const splits = splitTransferAmount(
              plan.amount_este_ciclo,
              plan.bookings,
            );
            for (const { bookingId: splitBookingId, amount } of splits) {
              const { error: importeError } = await supabase
                .from("bookings")
                .update({
                  importe_transferido: amount,
                  proveedor_sin_comision: plan.proveedorSinComision,
                })
                .eq("id", splitBookingId);

              if (importeError) {
                throw importeError;
              }
            }
          } catch (importeSaveError) {
            console.error(
              "[capture-payment] Error guardando importe_transferido",
              plan.proveedorId,
              importeSaveError.message ?? importeSaveError,
            );
          }

          if (plan.decrementSinComision) {
            const current = getReservasSinComisionProveedor(plan.profile);
            await supabase
              .from("profiles")
              .update({
                reservas_sin_comision_proveedor: Math.max(0, current - 1),
              })
              .eq("id", plan.proveedorId);
          }

          await rewardReferrerIfFirstCompletion(
            plan.proveedorId,
            plan.profile,
            resolvedPaymentIntentId,
          );

          summary.success = true;
          bookingIdsLiberados.push(...plan.bookingIds);
        } catch (providerError) {
          const errorMessage =
            providerError?.message ?? String(providerError);
          summary.error = errorMessage;
          console.error(
            "[capture-payment] Error procesando proveedor",
            plan.proveedorId,
            errorMessage,
          );

          if (plan.transfer_required) {
            transferErrors.push({
              proveedorId: plan.proveedorId,
              amount_este_ciclo: plan.amount_este_ciclo,
              total_a_transferir: plan.total_a_transferir,
              saldo_pendiente_anterior: plan.saldo_pendiente_anterior,
              error: errorMessage,
              booking_ids: plan.bookingIds,
            });
          } else {
            summary.success = true;
            bookingIdsLiberados.push(...plan.bookingIds);
          }
        }

        transferSummaries.push(summary);
      }
    }

    if (bookingIdsLiberados.length > 0) {
      const liberadoAt = new Date().toISOString();
      const { error: liberarError } = await supabase
        .from("bookings")
        .update({ pago_liberado_at: liberadoAt })
        .in("id", [...new Set(bookingIdsLiberados)]);

      if (liberarError) {
        console.error(
          "[capture-payment] Error marcando pago_liberado_at:",
          liberarError.message,
        );
      }
    }

    const hasRequiredTransferFailure = transferErrors.length > 0;

    return Response.json({
      success: !hasRequiredTransferFailure,
      paymentIntent,
      transfers,
      credito_grupo: creditoGrupo,
      grupo_usa_credito: grupoUsaCredito,
      capturado_neto: capturadoNeto,
      total_transferir: totalTransferirRounded,
      financiamiento,
      transferSummaries,
      transfer_errors: transferErrors,
      bookings_liberados: [...new Set(bookingIdsLiberados)],
      ...(hasRequiredTransferFailure
        ? {
            error:
              "Una o más transferencias obligatorias fallaron; pago_liberado_at no marcado en esas reservas",
          }
        : {}),
    }, hasRequiredTransferFailure ? { status: 500 } : undefined);
  } catch (error) {
    console.error("Error capture-payment:", error.message, error.type, error.code);
    return Response.json(
      { error: error.message, type: error.type, code: error.code },
      { status: 500 },
    );
  }
}
