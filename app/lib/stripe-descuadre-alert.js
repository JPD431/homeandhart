import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

/**
 * Alerta admin ante descuadre Stripe (M4).
 * - Inserta fila con PK dedupe_key (event_id:kind[:booking]) → no reenvía en reintentos.
 * - Envía email a ADMIN_EMAIL.
 * - Nunca lanza: el webhook debe seguir respondiendo 200.
 */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * @param {object} params
 * @param {import("stripe").Stripe.Event} params.event
 * @param {string} params.kind clave estable (ej. pi_canceled_activo, refund_mismatch)
 * @param {string} params.summary frase corta para el email
 * @param {Record<string, unknown>} [params.details]
 * @param {string|null} [params.paymentIntentId]
 * @param {string|null} [params.chargeId]
 * @param {string[]} [params.bookingIds]
 * @param {string|null} [params.bookingId] si se pasa, entra en dedupe_key (1 email por booking)
 */
export async function alertStripeDescuadre({
  event,
  kind,
  summary,
  details = {},
  paymentIntentId = null,
  chargeId = null,
  bookingIds = [],
  bookingId = null,
}) {
  try {
    if (!event?.id || !kind || !summary) {
      console.error("[stripe-descuadre] alert incompleta", {
        kind,
        event_id: event?.id,
      });
      return { ok: false, reason: "invalid" };
    }

    const ids = bookingId
      ? [bookingId]
      : [...new Set((bookingIds || []).filter(Boolean))];

    const dedupeKey = bookingId
      ? `${event.id}:${kind}:${bookingId}`
      : `${event.id}:${kind}`;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("[stripe-descuadre] Supabase no configurado");
      return { ok: false, reason: "no_supabase" };
    }

    const row = {
      dedupe_key: dedupeKey,
      event_id: event.id,
      event_type: event.type || "unknown",
      kind,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      booking_ids: ids,
      summary,
      details: {
        ...details,
        livemode: event.livemode ?? null,
      },
    };

    let shouldEmail = true;
    const { error: insertError } = await supabase
      .from("stripe_descuadre_alerts")
      .insert(row);

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: existing } = await supabase
          .from("stripe_descuadre_alerts")
          .select("email_sent")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        if (existing?.email_sent === true) {
          return { ok: true, reason: "duplicate", emailed: false };
        }
        // Insert previo sin email → reintentar envío.
        shouldEmail = true;
      } else {
        console.error(
          "[stripe-descuadre] Error insertando alerta:",
          insertError.message,
        );
        // Seguimos con email: mejor aviso sin rastro que ceguera total.
      }
    }

    if (!shouldEmail) {
      return { ok: true, reason: "skipped", emailed: false };
    }

    const emailResult = await sendPlatformEmail({
      tipo: "admin_stripe_descuadre",
      kind,
      summary,
      event_id: event.id,
      event_type: event.type,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      booking_ids: ids,
      details,
    });

    await supabase
      .from("stripe_descuadre_alerts")
      .update({
        email_sent: emailResult.ok === true,
        email_error: emailResult.ok
          ? null
          : emailResult.error || "email_fail",
      })
      .eq("dedupe_key", dedupeKey);

    if (!emailResult.ok) {
      console.error(
        "[stripe-descuadre] Email admin falló:",
        emailResult.error,
        { dedupeKey },
      );
      return { ok: false, reason: "email_fail", emailed: false };
    }

    return { ok: true, reason: "sent", emailed: true };
  } catch (err) {
    console.error(
      "[stripe-descuadre] Error no controlado (webhook no debe fallar):",
      err?.message ?? err,
    );
    return { ok: false, reason: "exception" };
  }
}
