import { creditCreditoDisponible } from "@/app/lib/credito-debito";
import { alertStripeDescuadre } from "@/app/lib/stripe-descuadre-alert";

/** PI pre-captura: cancel o capture parcial liberan el resto. */
export const CANCELABLE_PI_STATUSES = new Set([
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "requires_payment_method",
  "processing",
]);

/** Estados en los que un booking sigue “vivo” respecto a un PI compartido. */
export const BOOKING_ESTADOS_ACTIVOS_PI = new Set([
  "pendiente",
  "confirmada",
  "en_curso",
]);

export function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

/**
 * Devuelve crédito al cliente.
 * Con idempotencyKey: abono atómico vía RPC (no doble abono en reintento).
 * Sin key: fallback read→update (legacy; preferir siempre key).
 */
export async function devolverCreditoCliente(
  supabaseAdmin,
  clienteId,
  importe,
  logPrefix,
  { idempotencyKey } = {},
) {
  const value = roundMoney(importe);
  if (!clienteId || !(value > 0)) return 0;

  try {
    if (idempotencyKey) {
      return await creditCreditoDisponible(
        supabaseAdmin,
        clienteId,
        value,
        idempotencyKey,
      );
    }

    const { data: profile, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("credito_disponible")
      .eq("id", clienteId)
      .maybeSingle();

    if (readError || !profile) {
      console.error(
        `${logPrefix} No se pudo leer credito_disponible:`,
        readError?.message || "Perfil no encontrado",
        { clienteId },
      );
      return 0;
    }

    const actual = Number(profile.credito_disponible) || 0;
    const { error: writeError } = await supabaseAdmin
      .from("profiles")
      .update({ credito_disponible: roundMoney(actual + value) })
      .eq("id", clienteId);

    if (writeError) {
      console.error(
        `${logPrefix} No se pudo devolver credito_disponible:`,
        writeError,
        { clienteId, importe: value },
      );
      return 0;
    }
    return value;
  } catch (err) {
    console.error(`${logPrefix} No se pudo devolver credito_disponible:`, err, {
      clienteId,
      importe: value,
      idempotencyKey,
    });
    throw err;
  }
}

export async function contarBookingsPorPaymentIntent(supabaseAdmin, paymentIntentId) {
  if (!paymentIntentId) return 1;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("payment_intent_id", paymentIntentId);

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

/**
 * Cuenta bookings ACTIVOS que comparten el PI (excluye canceladas/rechazadas/etc.).
 * Si > 1, no se puede cancelar el PI entero al operar sobre una sola línea.
 */
export async function contarBookingsActivosPorPaymentIntent(
  supabaseAdmin,
  paymentIntentId,
  { excludeBookingId = null } = {},
) {
  if (!paymentIntentId) return 0;

  let query = supabaseAdmin
    .from("bookings")
    .select("id, estado")
    .eq("payment_intent_id", paymentIntentId);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).filter((b) => BOOKING_ESTADOS_ACTIVOS_PI.has(b.estado))
    .length;
}

async function getRefundedCentsForPaymentIntent(stripe, paymentIntent) {
  if (paymentIntent.latest_charge) {
    const charge =
      typeof paymentIntent.latest_charge === "object"
        ? paymentIntent.latest_charge
        : await stripe.charges.retrieve(paymentIntent.latest_charge);
    return Number(charge.amount_refunded) || 0;
  }

  const refunds = await stripe.refunds.list({
    payment_intent: paymentIntent.id,
    limit: 100,
  });

  return refunds.data.reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
}

function isStripeAlreadyCanceledError(err) {
  const message = (err?.message || "").toLowerCase();
  return (
    err?.code === "payment_intent_unexpected_state" ||
    message.includes("already been canceled") ||
    message.includes("cannot be canceled") ||
    message.includes("cannot cancel")
  );
}

function isStripeIdempotentReplayError(err) {
  const message = (err?.message || "").toLowerCase();
  return (
    err?.code === "idempotency_key_in_use" ||
    message.includes("idempotent") ||
    message.includes("keys for idempotent requests")
  );
}

/**
 * Reembolso Stripe sobre un PI (único o compartido en bundle).
 * Idempotente por idempotencyKey.
 *
 * M9: si el PI está compartido por otras reservas ACTIVAS, NUNCA cancela el PI
 * entero: solo refund/capture parcial del importe de ESTA línea.
 *
 * @param {object} [options]
 * @param {string} [options.idempotencyKey]
 * @param {import("@supabase/supabase-js").SupabaseClient} [options.supabaseAdmin]
 * @param {string} [options.bookingId]
 * @param {number|null} [options.sharedActiveOthers] si se conoce, evita recontar
 */
export async function aplicarReembolsoStripeBooking(
  stripe,
  paymentIntentId,
  reembolsoTarjeta,
  {
    idempotencyKey,
    supabaseAdmin = null,
    bookingId = null,
    sharedActiveOthers = null,
  } = {},
) {
  const stripeOpts = idempotencyKey ? { idempotencyKey } : undefined;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const { status, amount: piAmountCents } = paymentIntent;

  if (reembolsoTarjeta <= 0) {
    return { stripe_ok: true, stripe_action: "sin_cargo_tarjeta", pi_status: status };
  }

  const reembolsoCents = Math.round(reembolsoTarjeta * 100);

  let otrosActivos = sharedActiveOthers;
  if (otrosActivos == null && supabaseAdmin) {
    try {
      otrosActivos = await contarBookingsActivosPorPaymentIntent(
        supabaseAdmin,
        paymentIntentId,
        { excludeBookingId: bookingId },
      );
    } catch (err) {
      console.error(
        "[stripe-reembolso] Error contando bookings activos del PI:",
        err?.message ?? err,
        { paymentIntentId, bookingId },
      );
      otrosActivos = 0;
    }
  }
  if (otrosActivos == null) otrosActivos = 0;

  const piCompartidoActivo = otrosActivos > 0;

  if (piCompartidoActivo) {
    console.warn(
      "[stripe-reembolso] PI compartido con reservas activas — solo refund/capture parcial de esta línea",
      {
        payment_intent_id: paymentIntentId,
        booking_id: bookingId,
        otros_activos: otrosActivos,
        reembolso_tarjeta: reembolsoTarjeta,
        pi_amount_eur: roundMoney(piAmountCents / 100),
      },
    );
  }

  // PI ya liberado: recuperación tras Stripe OK + fallo de BD.
  if (status === "canceled") {
    if (piCompartidoActivo) {
      // PI cancelado pero aún hay bookings activos → anomalía grave.
      await alertStripeDescuadre({
        eventId: `shared-pi-canceled:${paymentIntentId}:${bookingId || "na"}`,
        eventType: "internal.shared_pi",
        kind: "shared_pi_ya_cancelado",
        summary: `PI compartido ${paymentIntentId} ya está canceled pero quedan ${otrosActivos} reserva(s) activa(s).`,
        paymentIntentId,
        bookingIds: bookingId ? [bookingId] : [],
        details: {
          booking_id: bookingId,
          otros_activos: otrosActivos,
          accion: "Revisar manualmente las otras líneas del grupo y el estado en Stripe.",
        },
      });
    }
    return {
      stripe_ok: true,
      stripe_action: "already_canceled",
      pi_status: status,
      shared_pi: piCompartidoActivo,
    };
  }

  if (status === "succeeded") {
    const refundedCents = await getRefundedCentsForPaymentIntent(
      stripe,
      paymentIntent,
    );
    const remainingCents = Math.max(0, piAmountCents - refundedCents);

    if (remainingCents < reembolsoCents) {
      await alertStripeDescuadre({
        eventId: `shared-pi-refund-cap:${paymentIntentId}:${bookingId || "na"}:${reembolsoCents}`,
        eventType: "internal.shared_pi",
        kind: "shared_pi_refund_insuficiente",
        summary: `No hay saldo suficiente en el PI para reembolsar ${roundMoney(reembolsoCents / 100)}€ (quedan ${roundMoney(remainingCents / 100)}€).`,
        paymentIntentId,
        bookingIds: bookingId ? [bookingId] : [],
        details: {
          booking_id: bookingId,
          required_cents: reembolsoCents,
          remaining_cents: remainingCents,
          refunded_cents: refundedCents,
          shared_pi: piCompartidoActivo,
          accion: "Revisión manual: posible PI compartido con reembolsos previos.",
        },
      });
      return {
        stripe_ok: false,
        stripe_action: null,
        pi_status: status,
        stripe_error: `Saldo reembolsable insuficiente en el PI (${roundMoney(remainingCents / 100)}€ < ${roundMoney(reembolsoCents / 100)}€)`,
        shared_pi: piCompartidoActivo,
      };
    }

    try {
      await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: reembolsoCents,
        },
        stripeOpts,
      );
      return {
        stripe_ok: true,
        stripe_action: "refund",
        pi_status: status,
        shared_pi: piCompartidoActivo,
      };
    } catch (err) {
      // Reintento idempotente: Stripe puede devolver la misma refund.
      if (idempotencyKey && isStripeIdempotentReplayError(err)) {
        return {
          stripe_ok: true,
          stripe_action: "already_refunded",
          pi_status: status,
          shared_pi: piCompartidoActivo,
        };
      }

      // Sin key / recuperación: solo si el reembolso pedido cabe en lo ya hecho
      // Y no hay otros activos — heurística legacy insegura en PI compartido.
      if (!piCompartidoActivo) {
        const refundedAfterError = await getRefundedCentsForPaymentIntent(
          stripe,
          paymentIntent,
        ).catch(() => refundedCents);

        if (refundedAfterError >= reembolsoCents) {
          return {
            stripe_ok: true,
            stripe_action: "already_refunded",
            pi_status: status,
            refunded_cents: refundedAfterError,
            required_cents: reembolsoCents,
          };
        }
      }

      throw err;
    }
  }

  if (CANCELABLE_PI_STATUSES.has(status)) {
    // M9: con otras reservas activas NUNCA cancelar el PI entero.
    if (piCompartidoActivo && reembolsoCents >= piAmountCents) {
      await alertStripeDescuadre({
        eventId: `shared-pi-full-cancel-blocked:${paymentIntentId}:${bookingId || "na"}`,
        eventType: "internal.shared_pi",
        kind: "shared_pi_cancel_bloqueado",
        summary: `Se bloqueó cancelar el PI entero ${paymentIntentId}: hay ${otrosActivos} reserva(s) activa(s) compartiendo el pago.`,
        paymentIntentId,
        bookingIds: bookingId ? [bookingId] : [],
        details: {
          booking_id: bookingId,
          reembolso_tarjeta: reembolsoTarjeta,
          pi_amount_eur: roundMoney(piAmountCents / 100),
          otros_activos: otrosActivos,
          accion:
            "Revisión manual. No se liberó el hold de las otras líneas. Ajusta importes o cancela el grupo completo.",
        },
      });
      return {
        stripe_ok: false,
        stripe_action: null,
        pi_status: status,
        stripe_error:
          "PI compartido: no se puede cancelar el cargo completo porque otras reservas activas lo usan. Gestión manual requerida.",
        shared_pi: true,
      };
    }

    if (!piCompartidoActivo && reembolsoCents >= piAmountCents) {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId, {}, stripeOpts);
        return { stripe_ok: true, stripe_action: "cancel", pi_status: status };
      } catch (err) {
        if (isStripeAlreadyCanceledError(err)) {
          return {
            stripe_ok: true,
            stripe_action: "already_canceled",
            pi_status: "canceled",
          };
        }
        throw err;
      }
    }

    const amountToCapture = piAmountCents - reembolsoCents;
    if (amountToCapture <= 0) {
      if (piCompartidoActivo) {
        await alertStripeDescuadre({
          eventId: `shared-pi-capture-zero-blocked:${paymentIntentId}:${bookingId || "na"}`,
          eventType: "internal.shared_pi",
          kind: "shared_pi_cancel_bloqueado",
          summary: `PI compartido ${paymentIntentId}: capture residual ≤ 0 con otras reservas activas — cancel bloqueado.`,
          paymentIntentId,
          bookingIds: bookingId ? [bookingId] : [],
          details: {
            booking_id: bookingId,
            otros_activos: otrosActivos,
            accion: "Revisión manual del bundle legacy.",
          },
        });
        return {
          stripe_ok: false,
          stripe_action: null,
          pi_status: status,
          stripe_error:
            "PI compartido: no se puede liberar todo el hold; otras reservas activas dependen de él.",
          shared_pi: true,
        };
      }

      try {
        await stripe.paymentIntents.cancel(paymentIntentId, {}, stripeOpts);
        return { stripe_ok: true, stripe_action: "cancel", pi_status: status };
      } catch (err) {
        if (isStripeAlreadyCanceledError(err)) {
          return {
            stripe_ok: true,
            stripe_action: "already_canceled",
            pi_status: "canceled",
          };
        }
        throw err;
      }
    }

    // Capture el resto (otras líneas del bundle / parte no reembolsada).
    await stripe.paymentIntents.capture(
      paymentIntentId,
      { amount_to_capture: amountToCapture },
      stripeOpts,
    );
    return {
      stripe_ok: true,
      stripe_action: "capture_parcial",
      pi_status: status,
      amount_captured_cents: amountToCapture,
      shared_pi: piCompartidoActivo,
    };
  }

  return {
    stripe_ok: false,
    stripe_action: null,
    pi_status: status,
    stripe_error: `Estado del PaymentIntent no manejado para reembolso: ${status}`,
  };
}

/** Reembolso 100 % al cliente (tarjeta + crédito aplicado). */
export function calcularReembolsoTotal(booking) {
  const precioTotal = Number(booking.precio_total) || 0;
  const creditoAplicado = Number(booking.credito_aplicado) || 0;
  const reembolsoBruto = roundMoney(precioTotal);
  const reembolsoCredito = roundMoney(creditoAplicado);
  const reembolsoTarjeta = roundMoney(reembolsoBruto - reembolsoCredito);

  return {
    pct: 100,
    bruto: reembolsoBruto,
    credito: reembolsoCredito,
    tarjeta: reembolsoTarjeta,
  };
}
