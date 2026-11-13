import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  aplicarReembolsoStripeBooking,
  calcularReembolsoTotal,
} from "@/app/lib/stripe-reembolso";

let stripeSingleton = null;
let supabaseAdminSingleton = null;

function getStripe(stripeOverride) {
  if (stripeOverride) return stripeOverride;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeSingleton;
}

function getSupabaseAdmin(adminOverride) {
  if (adminOverride) return adminOverride;
  if (!supabaseAdminSingleton) {
    supabaseAdminSingleton = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return supabaseAdminSingleton;
}

/**
 * Libera el hold de ESTA línea al rechazar / expirar (F6 + M9).
 * Idempotente por bookingId. Si el PI es compartido con otras reservas activas,
 * hace capture parcial (no cancela el PI entero).
 *
 * Comportamiento idéntico al helper local de respond/route.js.
 *
 * @param {object} booking — necesita id, payment_intent_id, precio_total, credito_aplicado
 * @param {{
 *   stripe?: import("stripe").Stripe,
 *   supabaseAdmin?: import("@supabase/supabase-js").SupabaseClient,
 *   idempotencyKey?: string,
 * }} [opts]
 */
export async function cancelPaymentIntentOnReject(booking, opts = {}) {
  const paymentIntentId = booking?.payment_intent_id;
  if (!paymentIntentId) {
    return { ok: true, action: "sin_pi" };
  }

  const { tarjeta } = calcularReembolsoTotal(booking);
  // Solo crédito / sin tarjeta: no tocar el PI (puede estar compartido).
  if (tarjeta <= 0) {
    return { ok: true, action: "sin_cargo_tarjeta" };
  }

  const stripe = getStripe(opts.stripe);
  const supabaseAdmin = getSupabaseAdmin(opts.supabaseAdmin);
  const idempotencyKey =
    opts.idempotencyKey || `cancel-pi:respond-reject:${booking.id}`;

  const result = await aplicarReembolsoStripeBooking(
    stripe,
    paymentIntentId,
    tarjeta,
    {
      idempotencyKey,
      supabaseAdmin,
      bookingId: booking.id,
    },
  );

  if (result.stripe_ok === false) {
    return {
      ok: false,
      action: result.stripe_action,
      pi_status: result.pi_status,
      error: result.stripe_error,
    };
  }

  return {
    ok: true,
    action: result.stripe_action,
    pi_status: result.pi_status,
  };
}
