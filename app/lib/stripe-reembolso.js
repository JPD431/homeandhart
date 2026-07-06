/** PI pre-captura: cancel o capture parcial liberan el resto. */
export const CANCELABLE_PI_STATUSES = new Set([
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "requires_payment_method",
  "processing",
]);

export function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

export async function devolverCreditoCliente(supabaseAdmin, clienteId, importe, logPrefix) {
  if (!importe || importe <= 0) return;

  try {
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
      return;
    }

    const actual = Number(profile.credito_disponible) || 0;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ credito_disponible: roundMoney(actual + importe) })
      .eq("id", clienteId);

    if (updateError) {
      console.error(
        `${logPrefix} No se pudo devolver credito_disponible:`,
        updateError,
        { clienteId, importe },
      );
    }
  } catch (err) {
    console.error(`${logPrefix} No se pudo devolver credito_disponible:`, err, {
      clienteId,
      importe,
    });
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

/**
 * Reembolso Stripe sobre un PI (único o compartido en bundle).
 * Idempotente: PI ya cancelado / refund ya aplicado → éxito sin repetir la acción.
 */
export async function aplicarReembolsoStripeBooking(
  stripe,
  paymentIntentId,
  reembolsoTarjeta,
  { idempotencyKey } = {},
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

  // PI ya liberado: recuperación tras Stripe OK + fallo de BD.
  if (status === "canceled") {
    return {
      stripe_ok: true,
      stripe_action: "already_canceled",
      pi_status: status,
    };
  }

  if (status === "succeeded") {
    const refundedCents = await getRefundedCentsForPaymentIntent(stripe, paymentIntent);
    if (refundedCents >= reembolsoCents) {
      return {
        stripe_ok: true,
        stripe_action: "already_refunded",
        pi_status: status,
        refunded_cents: refundedCents,
        required_cents: reembolsoCents,
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
      return { stripe_ok: true, stripe_action: "refund", pi_status: status };
    } catch (err) {
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

      throw err;
    }
  }

  if (CANCELABLE_PI_STATUSES.has(status)) {
    if (reembolsoCents >= piAmountCents) {
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
