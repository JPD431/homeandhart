/**
 * Mensajes de pago accionables a partir de errores Stripe / API.
 * No expone códigos técnicos al usuario.
 */

const DECLINE_MESSAGES = {
  insufficient_funds:
    "Tu tarjeta no tiene fondos suficientes. Prueba con otra tarjeta o método de pago.",
  lost_card:
    "Esta tarjeta no se puede usar. Prueba con otra tarjeta.",
  stolen_card:
    "Esta tarjeta no se puede usar. Prueba con otra tarjeta.",
  expired_card:
    "Tu tarjeta está caducada. Prueba con otra tarjeta.",
  incorrect_cvc:
    "El código de seguridad (CVC) no es correcto. Revísalo e inténtalo de nuevo.",
  incorrect_number:
    "El número de tarjeta no es correcto. Revísalo e inténtalo de nuevo.",
  invalid_cvc:
    "El código de seguridad (CVC) no es válido. Revísalo e inténtalo de nuevo.",
  invalid_expiry_month:
    "La fecha de caducidad no es válida. Revísala e inténtalo de nuevo.",
  invalid_expiry_year:
    "La fecha de caducidad no es válida. Revísala e inténtalo de nuevo.",
  invalid_number:
    "El número de tarjeta no es válido. Revísalo e inténtalo de nuevo.",
  card_declined:
    "Tu tarjeta fue rechazada. Prueba con otra tarjeta o contacta con tu banco.",
  generic_decline:
    "Tu tarjeta fue rechazada. Prueba con otra tarjeta o contacta con tu banco.",
  do_not_honor:
    "Tu banco ha rechazado el pago. Prueba con otra tarjeta o contacta con tu banco.",
  call_issuer:
    "Tu banco necesita autorizar este pago. Contacta con ellos o prueba otra tarjeta.",
  processing_error:
    "Hubo un problema al procesar el pago. Espera un momento e inténtalo de nuevo.",
  try_again_later:
    "No hemos podido procesar el pago ahora. Inténtalo de nuevo en unos segundos.",
  authentication_required:
    "Tu banco pide una verificación adicional. Completa la autenticación e inténtalo de nuevo.",
};

const CODE_MESSAGES = {
  card_declined:
    "Tu tarjeta fue rechazada. Prueba con otra tarjeta o contacta con tu banco.",
  expired_card:
    "Tu tarjeta está caducada. Prueba con otra tarjeta.",
  incorrect_cvc:
    "El código de seguridad (CVC) no es correcto. Revísalo e inténtalo de nuevo.",
  processing_error:
    "Hubo un problema al procesar el pago. Espera un momento e inténtalo de nuevo.",
  payment_intent_authentication_failure:
    "No se pudo verificar el pago con tu banco. Inténtalo de nuevo.",
  payment_intent_payment_attempt_failed:
    "El intento de pago no se pudo completar. Prueba de nuevo o usa otra tarjeta.",
  rate_limit:
    "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.",
};

const GENERIC =
  "No se pudo completar el pago. Revisa los datos de tu tarjeta e inténtalo de nuevo.";

/**
 * @param {unknown} err — StripeError, Error, string o respuesta API
 * @returns {string}
 */
export function friendlyStripePaymentError(err) {
  if (!err) return GENERIC;

  if (typeof err === "string") {
    return sanitizeKnownTechnical(err) || GENERIC;
  }

  const declineCode =
    err.decline_code ||
    err.declineCode ||
    err.payment_intent?.last_payment_error?.decline_code ||
    err.raw?.decline_code;

  if (declineCode && DECLINE_MESSAGES[declineCode]) {
    return DECLINE_MESSAGES[declineCode];
  }

  const code = err.code || err.error_code || err.type;
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  // Stripe a veces mete el decline en message + code card_declined
  if (code === "card_declined" || /declin|rechaz/i.test(String(err.message || ""))) {
    return DECLINE_MESSAGES.card_declined;
  }

  const msg = typeof err.message === "string" ? err.message.trim() : "";
  if (msg && !looksTechnical(msg)) {
    return msg;
  }

  return GENERIC;
}

function looksTechnical(msg) {
  return (
    /payment_intent|client_secret|api_key|request_id|idempotency|stripe\.com|type:\s*['"]?\w+/i.test(
      msg,
    ) || msg.length > 220
  );
}

function sanitizeKnownTechnical(msg) {
  const trimmed = msg.trim();
  if (!trimmed) return null;
  if (looksTechnical(trimmed)) return GENERIC;
  return trimmed;
}

/**
 * Cancela un PaymentIntent no asociado a reserva (best-effort).
 * @param {string | null | undefined} paymentIntentId
 */
export async function cancelOrphanPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return;
  try {
    await fetch("/api/stripe/cancel-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
      keepalive: true,
    });
  } catch (err) {
    console.warn(
      "[stripe-payment-errors] No se pudo cancelar PI huérfano:",
      paymentIntentId,
      err?.message || err,
    );
  }
}
