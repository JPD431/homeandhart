import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getIngresoProveedorDesdeBase,
  getPrecioBaseProveedor,
} from "@/app/lib/ingresos-proveedor";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STRIPE_MIN_TRANSFER_EUR = 0.5;

function splitTransferAmount(amountFinal, bookings) {
  if (!bookings?.length) return [];

  if (bookings.length === 1) {
    return [{ bookingId: bookings[0].id, amount: amountFinal }];
  }

  const bases = bookings.map((b) => ({
    id: b.id,
    base: getPrecioBaseProveedor(b.precio_total),
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
    .select("id, service_id, precio_total, credito_aplicado")
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
        reservas_sin_comision,
        referido_por,
        deuda_pendiente
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
        reservas_sin_comision: Number(profile.reservas_sin_comision) || 0,
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
      entry.amount += getPrecioBaseProveedor(booking.precio_total);
      entry.bookingIds.push(booking.id);
      entry.bookings.push({ id: booking.id, precio_total: booking.precio_total });
    }
  }

  const plans = [];

  for (const entry of proveedorMap.values()) {
    if (entry.amount <= 0) continue;

    const sinComision = entry.reservas_sin_comision > 0;
    const amountBruto = getIngresoProveedorDesdeBase(entry.amount, {
      sinComision,
    });
    plans.push({
      proveedorId: entry.proveedorId,
      stripe_account_id: entry.stripe_account_id,
      amount: amountBruto,
      amount_bruto: amountBruto,
      deuda_actual: Number(entry.profile?.deuda_pendiente) || 0,
      profile: entry.profile,
      decrementSinComision: sinComision,
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
      const amount_final =
        Math.round((plan.amount_bruto - deuda_a_descontar) * 100) / 100;
      return {
        ...plan,
        deuda_a_descontar,
        amount_final,
        transfer_required: amount_final >= STRIPE_MIN_TRANSFER_EUR,
      };
    });

    const totalTransferir = preparedPlans.reduce(
      (sum, plan) => sum + plan.amount_final,
      0,
    );
    const totalTransferirRounded = Math.round(totalTransferir * 100) / 100;
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
          amount_final: plan.amount_final,
          deuda_descontada: 0,
          amount_transferido: 0,
          deuda_restante: plan.deuda_actual,
          transfer_required: plan.transfer_required,
          financiamiento,
          success: false,
          error: null,
          booking_ids: plan.bookingIds,
        };

        try {
          if (plan.transfer_required) {
            const transferParams = {
              amount: Math.round(plan.amount_final * 100),
              currency: "eur",
              destination: plan.stripe_account_id,
            };

            if (!usePlatformBalance) {
              transferParams.source_transaction = chargeId;
            }

            const transfer = await stripe.transfers.create(transferParams);
            transfers.push(transfer);
            summary.amount_transferido = plan.amount_final;
          }

          const deuda_restante = Math.max(
            0,
            plan.deuda_actual - plan.deuda_a_descontar,
          );
          const { error: deudaError } = await supabase
            .from("profiles")
            .update({ deuda_pendiente: deuda_restante })
            .eq("id", plan.proveedorId);

          if (deudaError) {
            throw deudaError;
          }

          summary.deuda_descontada = plan.deuda_a_descontar;
          summary.deuda_restante = deuda_restante;

          try {
            const splits = splitTransferAmount(plan.amount_final, plan.bookings);
            for (const { bookingId: splitBookingId, amount } of splits) {
              const { error: importeError } = await supabase
                .from("bookings")
                .update({ importe_transferido: amount })
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
            const current = Number(plan.profile.reservas_sin_comision) || 0;
            await supabase
              .from("profiles")
              .update({ reservas_sin_comision: Math.max(0, current - 1) })
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
              amount_final: plan.amount_final,
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
