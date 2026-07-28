import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { CANCELABLE_PI_STATUSES } from "@/app/lib/stripe-reembolso";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Holds sin booking más antiguos que esto se cancelan (red de seguridad M3). */
const HOLD_MAX_AGE_HOURS = 48;
/** Páginas máximas de Stripe list por ejecución (100 PI/página). */
const MAX_PAGES = 5;

/**
 * Cancela PaymentIntents en requires_capture (u otros cancelables) creados hace
 * más de HOLD_MAX_AGE_HOURS sin fila en bookings.payment_intent_id.
 */
export async function runCancelHoldsHuerfanos() {
  const cutoffUnix = Math.floor(Date.now() / 1000) - HOLD_MAX_AGE_HOURS * 3600;

  let canceled = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;
  let startingAfter;

  for (let page = 0; page < MAX_PAGES; page++) {
    const list = await stripe.paymentIntents.list({
      limit: 100,
      created: { lt: cutoffUnix },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const paymentIntent of list.data) {
      scanned += 1;

      if (!CANCELABLE_PI_STATUSES.has(paymentIntent.status)) {
        skipped += 1;
        continue;
      }

      // Solo PIs de nuestra app (metadata de reserva).
      if (!paymentIntent.metadata?.cliente_id) {
        skipped += 1;
        continue;
      }

      try {
        const { data: bookings, error } = await supabaseAdmin
          .from("bookings")
          .select("id")
          .eq("payment_intent_id", paymentIntent.id)
          .limit(1);

        if (error) {
          errors += 1;
          console.error(
            "[cron/holds-huerfanos] Error buscando booking:",
            paymentIntent.id,
            error.message,
          );
          continue;
        }

        if ((bookings ?? []).length > 0) {
          skipped += 1;
          continue;
        }

        await stripe.paymentIntents.cancel(
          paymentIntent.id,
          {},
          {
            idempotencyKey: `cancel-pi:cron-hold-huerfano:${paymentIntent.id}`,
          },
        );
        canceled += 1;
      } catch (err) {
        const message = (err?.message || "").toLowerCase();
        if (
          err?.code === "payment_intent_unexpected_state" ||
          message.includes("already been canceled")
        ) {
          skipped += 1;
          continue;
        }
        errors += 1;
        console.error(
          "[cron/holds-huerfanos] Error cancelando PI:",
          paymentIntent.id,
          err?.message ?? err,
        );
      }
    }

    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1].id;
  }

  return {
    hold_max_age_hours: HOLD_MAX_AGE_HOURS,
    scanned,
    canceled,
    skipped,
    errors,
  };
}
