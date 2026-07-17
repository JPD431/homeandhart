import Stripe from "stripe";
import {
  getBookingPrecioBase,
  getIngresoProveedorDesdeBase,
  roundMoney,
} from "@/app/lib/ingresos-proveedor";
import { calcularCapturaRepartoCents, validarCapturaRepartoStripe } from "@/app/lib/incidencia-reparto-bote";
import { ejecutarTransferProveedorConDeudaSaldo } from "@/app/lib/transfer-proveedor";
import { CANCELABLE_PI_STATUSES } from "@/app/lib/stripe-reembolso";
import { notifyProveedoresPagosLiberados } from "@/app/lib/pago-liberado-notify";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const STRIPE_MIN_TRANSFER_EUR = 0.5;

function getReservasSinComisionProveedor(profile) {
  return Number(profile?.reservas_sin_comision_proveedor) || 0;
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

async function buildTransfersForPayment(supabase, paymentIntentId) {
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

/**
 * Captura un PaymentIntent y transfiere al proveedor (misma lógica que capture-payment).
 * Llamada directa desde route, cron o liberar-proveedor — sin HTTP interno.
 */
export async function capturarYTransferirPago(
  supabase,
  paymentIntentId,
  { logPrefix = "[capturar-y-transferir]" } = {},
) {
  if (!paymentIntentId) {
    return { success: false, error: "Falta paymentIntentId" };
  }

  const { data: existingBookings, error: existingBookingsError } = await supabase
    .from("bookings")
    .select("id, pago_liberado_at")
    .eq("payment_intent_id", paymentIntentId);

  if (existingBookingsError) {
    return {
      success: false,
      error: "No se pudo comprobar el estado del pago",
    };
  }

  if (
    existingBookings?.length > 0 &&
    existingBookings.every((b) => b.pago_liberado_at != null)
  ) {
    // Reintento idempotente: si el aviso falló la primera vez, se envía ahora.
    try {
      await notifyProveedoresPagosLiberados(
        existingBookings.map((b) => b.id),
        logPrefix,
      );
    } catch (notifyErr) {
      console.error(
        `${logPrefix} Aviso pago liberado (already_processed) falló; pago no afectado:`,
        notifyErr?.message ?? notifyErr,
      );
    }
    return { success: true, already_processed: true };
  }

  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  const chargeId = paymentIntent.latest_charge;

  const {
    plans: transferPlan,
    creditoGrupo,
    grupoUsaCredito,
  } = await buildTransfersForPayment(supabase, paymentIntentId);

  const preparedPlans = transferPlan.map((plan) => {
    const deuda_a_descontar = Math.min(plan.deuda_actual, plan.amount_bruto);
    const amount_este_ciclo = roundMoney(plan.amount_bruto - deuda_a_descontar);
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

      const { data: bookingStates, error: bookingStatesError } = await supabase
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
          const splits = splitTransferAmount(plan.amount_este_ciclo, plan.bookings);
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
            `${logPrefix} Error guardando importe_transferido`,
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

        summary.success = true;
        bookingIdsLiberados.push(...plan.bookingIds);
      } catch (providerError) {
        const errorMessage = providerError?.message ?? String(providerError);
        summary.error = errorMessage;
        console.error(
          `${logPrefix} Error procesando proveedor`,
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
        `${logPrefix} Error marcando pago_liberado_at:`,
        liberarError.message,
      );
    } else {
      try {
        await notifyProveedoresPagosLiberados(
          bookingIdsLiberados,
          logPrefix,
        );
      } catch (notifyErr) {
        console.error(
          `${logPrefix} Aviso pago liberado falló; pago no afectado:`,
          notifyErr?.message ?? notifyErr,
        );
      }
    }
  }

  const hasRequiredTransferFailure = transferErrors.length > 0;

  return {
    success: !hasRequiredTransferFailure,
    already_processed: false,
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
  };
}

async function loadProveedorParaTransfer(supabase, serviceId) {
  const { data: service, error } = await supabase
    .from("services")
    .select(
      `
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id,
        deuda_pendiente,
        saldo_pendiente_transferir,
        cobros_activos
      )
    `,
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !service?.proveedor_id) {
    return { error: error?.message || "Servicio o proveedor no encontrado" };
  }

  return {
    proveedorId: service.proveedor_id,
    stripeAccountId: service.profiles?.stripe_account_id,
    profile: service.profiles,
  };
}

/**
 * Reparto en incidencia: captura parcial (total tarjeta − devolución cliente) y transfiere P al proveedor.
 * H&H retiene comisiones fijas; importe_cliente queda sin capturar en tarjeta.
 */
export async function capturarRepartoIncidencia(
  supabase,
  paymentIntentId,
  {
    bookingId,
    serviceId,
    importeProveedor,
    importeTarjeta,
    tarjetaCliente,
    comisionHHTotal,
    creditoAplicado = 0,
    logPrefix = "[capturar-reparto]",
  },
  { idempotencyKey } = {},
) {
  const stripeOpts = idempotencyKey ? { idempotencyKey } : undefined;

  if (!paymentIntentId) {
    return { success: false, error: "Falta paymentIntentId" };
  }

  const { data: bookingRow } = await supabase
    .from("bookings")
    .select("pago_liberado_at, importe_transferido, proveedor_sin_comision")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingRow?.pago_liberado_at) {
    return {
      success: true,
      already_processed: true,
      importe_transferido: bookingRow.importe_transferido,
    };
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    return { success: false, error: err?.message ?? String(err) };
  }

  const piStatus = paymentIntent.status;

  if (piStatus === "canceled") {
    return {
      success: false,
      error: "El pago ya está liberado al cliente, no se puede repartir.",
      pi_status: piStatus,
    };
  }

  const piAmountCents = paymentIntent.amount;
  const amountToCaptureCents = calcularCapturaRepartoCents(
    importeTarjeta,
    tarjetaCliente,
    piAmountCents,
  );

  const capturaCheck = validarCapturaRepartoStripe(
    amountToCaptureCents,
    importeProveedor,
    piAmountCents,
  );

  if (!capturaCheck.ok) {
    return {
      success: false,
      error: capturaCheck.error,
      pi_status: piStatus,
      amount_captured_cents: amountToCaptureCents,
    };
  }

  const cancelPiOnly = capturaCheck.action === "cancel_pi";

  let chargeId = paymentIntent.latest_charge;

  if (CANCELABLE_PI_STATUSES.has(piStatus)) {
    try {
      if (cancelPiOnly || amountToCaptureCents <= 0) {
        await stripe.paymentIntents.cancel(paymentIntentId, {}, stripeOpts);
        chargeId = null;
      } else if (amountToCaptureCents >= piAmountCents) {
        const captured = await stripe.paymentIntents.capture(
          paymentIntentId,
          {},
          stripeOpts,
        );
        chargeId = captured.latest_charge;
      } else {
        const captured = await stripe.paymentIntents.capture(
          paymentIntentId,
          { amount_to_capture: amountToCaptureCents },
          stripeOpts,
        );
        chargeId = captured.latest_charge;
      }
    } catch (err) {
      return {
        success: false,
        error: err?.message ?? String(err),
        pi_status: piStatus,
        stripe_code: err?.code,
      };
    }
  } else if (piStatus === "succeeded") {
    return {
      success: false,
      error: "PI ya capturado: usar flujo de refund parcial.",
      pi_status: piStatus,
      requires_refund_path: true,
    };
  } else {
    return {
      success: false,
      error: `Estado del PaymentIntent no manejado para reparto: ${piStatus}`,
      pi_status: piStatus,
    };
  }

  const capturadoNeto = roundMoney(amountToCaptureCents / 100);
  let transferSummary = null;

  if (importeProveedor > 0) {
    const proveedorInfo = await loadProveedorParaTransfer(supabase, serviceId);
    if (proveedorInfo.error) {
      return { success: false, error: proveedorInfo.error };
    }

    const usePlatformBalance =
      creditoAplicado > 0 ||
      roundMoney(importeProveedor) > capturadoNeto;

    transferSummary = await ejecutarTransferProveedorConDeudaSaldo({
      stripe,
      supabase,
      proveedorId: proveedorInfo.proveedorId,
      stripeAccountId: proveedorInfo.stripeAccountId,
      profile: proveedorInfo.profile,
      amountBruto: importeProveedor,
      chargeId: usePlatformBalance ? null : chargeId,
      usePlatformBalance,
      logPrefix,
    });

    if (!transferSummary.success) {
      return {
        success: false,
        error: transferSummary.error || "Error al transferir al proveedor.",
        transfer: transferSummary,
        capturado_neto: capturadoNeto,
      };
    }

    await supabase
      .from("bookings")
      .update({
        importe_transferido: roundMoney(importeProveedor),
        ...(bookingRow?.proveedor_sin_comision != null
          ? { proveedor_sin_comision: bookingRow.proveedor_sin_comision }
          : {}),
      })
      .eq("id", bookingId);
  }

  const liberadoAt = new Date().toISOString();
  await supabase
    .from("bookings")
    .update({ pago_liberado_at: liberadoAt })
    .eq("id", bookingId);

  return {
    success: true,
    already_processed: false,
    pi_status: piStatus,
    stripe_action: cancelPiOnly
      ? "cancel"
      : amountToCaptureCents >= piAmountCents
        ? "capture"
        : "capture_parcial",
    amount_captured_cents: amountToCaptureCents,
    capturado_neto: capturadoNeto,
    importe_proveedor: roundMoney(importeProveedor),
    transfer: transferSummary,
    pago_liberado_at: liberadoAt,
  };
}
