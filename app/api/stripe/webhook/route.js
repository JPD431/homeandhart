import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const runtime = "nodejs";

const ACTIVE_BOOKING_STATES = new Set(["confirmada", "pendiente", "en_curso"]);

const REFUND_MISMATCH_TOLERANCE_EUR = 0.02;

function getPaymentIntentId(ref) {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref.id ?? null;
}

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

async function findBookingsByPaymentIntentId(paymentIntentId) {
  if (!paymentIntentId) {
    return { bookings: [], queryError: null };
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, estado, payment_intent_id, reembolso_cliente_total, reembolso_cliente_credito",
    )
    .eq("payment_intent_id", paymentIntentId);

  if (error) {
    console.error(
      "[stripe/webhook] Error buscando bookings por payment_intent_id:",
      paymentIntentId,
      error.message,
    );
    return { bookings: [], queryError: error };
  }

  return { bookings: data ?? [], queryError: null };
}

async function handlePaymentIntentCanceled(event) {
  const paymentIntent = event.data.object;
  const paymentIntentId = paymentIntent?.id;

  if (!paymentIntentId) {
    console.warn(
      "[stripe/webhook] payment_intent.canceled sin id en el payload",
      { event_id: event.id },
    );
    return;
  }

  const { bookings, queryError } =
    await findBookingsByPaymentIntentId(paymentIntentId);

  if (queryError) {
    return;
  }

  if (bookings.length === 0) {
    console.log(
      "[stripe/webhook] payment_intent.canceled sin bookings en BD",
      { payment_intent_id: paymentIntentId, event_id: event.id },
    );
    return;
  }

  const activos = bookings.filter((b) => ACTIVE_BOOKING_STATES.has(b.estado));

  if (activos.length === 0) {
    console.log(
      "[stripe/webhook] payment_intent.canceled coherente con bookings terminales",
      {
        payment_intent_id: paymentIntentId,
        booking_ids: bookings.map((b) => b.id),
        estados: bookings.map((b) => ({ id: b.id, estado: b.estado })),
      },
    );
    return;
  }

  for (const booking of activos) {
    console.warn(
      "[stripe/webhook] DESCUADRE payment_intent.canceled: PI cancelado en Stripe pero booking activo",
      {
        booking_id: booking.id,
        payment_intent_id: paymentIntentId,
        estado: booking.estado,
        event_id: event.id,
      },
    );
  }
}

async function handleChargeRefunded(event) {
  const charge = event.data.object;
  const paymentIntentId = getPaymentIntentId(charge?.payment_intent);
  const amountRefundedCents = Number(charge?.amount_refunded) || 0;
  const amountRefundedEur = roundMoney(amountRefundedCents / 100);

  if (!paymentIntentId) {
    console.warn("[stripe/webhook] charge.refunded sin payment_intent", {
      charge_id: charge?.id,
      event_id: event.id,
    });
    return;
  }

  const { bookings, queryError } =
    await findBookingsByPaymentIntentId(paymentIntentId);

  if (queryError) {
    return;
  }

  if (bookings.length === 0) {
    console.log("[stripe/webhook] charge.refunded sin bookings en BD", {
      payment_intent_id: paymentIntentId,
      charge_id: charge?.id,
      amount_refunded_eur: amountRefundedEur,
      event_id: event.id,
    });
    return;
  }

  for (const booking of bookings) {
    const reembolsoTotal =
      booking.reembolso_cliente_total != null
        ? roundMoney(booking.reembolso_cliente_total)
        : null;
    const reembolsoCredito =
      booking.reembolso_cliente_credito != null
        ? roundMoney(booking.reembolso_cliente_credito)
        : 0;
    const expectedTarjetaEur =
      reembolsoTotal != null
        ? roundMoney(Math.max(0, reembolsoTotal - reembolsoCredito))
        : null;

    const logPayload = {
      booking_id: booking.id,
      payment_intent_id: paymentIntentId,
      charge_id: charge?.id,
      stripe_amount_refunded_eur: amountRefundedEur,
      reembolso_cliente_total: reembolsoTotal,
      reembolso_cliente_credito: reembolsoCredito,
      expected_tarjeta_eur: expectedTarjetaEur,
      estado: booking.estado,
      event_id: event.id,
    };

    const compareAgainst =
      expectedTarjetaEur != null ? expectedTarjetaEur : reembolsoTotal;

    if (compareAgainst == null) {
      console.log(
        "[stripe/webhook] charge.refunded registrado (sin reembolso_cliente_total en booking)",
        logPayload,
      );
      continue;
    }

    const diff = Math.abs(amountRefundedEur - compareAgainst);
    if (diff > REFUND_MISMATCH_TOLERANCE_EUR) {
      console.warn(
        "[stripe/webhook] DESCUADRE charge.refunded: importe Stripe difiere del esperado",
        { ...logPayload, diff_eur: roundMoney(diff) },
      );
    } else {
      console.log(
        "[stripe/webhook] charge.refunded coherente con booking",
        logPayload,
      );
    }
  }
}

function isCuentaListaParaCobrar(account) {
  if (!account.payouts_enabled || !account.details_submitted) {
    return false;
  }
  const transfers = account.capabilities?.transfers;
  if (transfers != null && transfers !== "active") {
    return false;
  }
  return true;
}

async function handleAccountUpdated(account) {
  const lista = isCuentaListaParaCobrar(account);

  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (findError) {
    console.error("[stripe/webhook] Error buscando proveedor:", findError.message);
    throw findError;
  }

  if (!profile) {
    console.warn(
      "[stripe/webhook] account.updated sin perfil para",
      account.id,
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ cobros_activos: lista })
    .eq("id", profile.id);

  if (updateError) {
    console.error("[stripe/webhook] Error actualizando cobros_activos:", updateError.message);
    throw updateError;
  }
}

/** Handlers de reconciliación (Fase B). Sin acciones de dinero. */
const eventHandlers = {
  "account.updated": (event) => handleAccountUpdated(event.data.object),
  "payment_intent.canceled": handlePaymentIntentCanceled,
  "charge.refunded": handleChargeRefunded,
};

function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  if (typeof err?.message === "string") return err.message;
  return String(err);
}

/**
 * INSERT ON CONFLICT DO NOTHING vía insert + 23505.
 * Si ya existe con processed_at → duplicado.
 * Si ya existe sin processed_at → reintento Stripe tras fallo previo.
 */
async function claimWebhookEvent(event) {
  const row = {
    event_id: event.id,
    type: event.type,
    livemode: event.livemode,
  };

  const { error: insertError } = await supabase
    .from("stripe_webhook_events")
    .insert(row);

  if (!insertError) {
    return { status: "new" };
  }

  if (insertError.code !== "23505") {
    throw insertError;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("event_id", event.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing?.processed_at != null) {
    return { status: "duplicate" };
  }

  return { status: "retry" };
}

async function markEventProcessed(eventId) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }
}

async function markEventFailed(eventId, err) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({ error: getErrorMessage(err) })
    .eq("event_id", eventId);

  if (error) {
    console.error(
      "[stripe/webhook] No se pudo guardar error del evento:",
      eventId,
      error.message,
    );
  }
}

async function dispatchEvent(event) {
  const handler = eventHandlers[event.type];
  if (!handler) {
    return { handled: false };
  }

  await handler(event);
  return { handled: true };
}

function getWebhookSecrets() {
  const secrets = [];
  const primary = process.env.STRIPE_WEBHOOK_SECRET;
  const secondary = process.env.STRIPE_WEBHOOK_SECRET_2;

  if (primary) secrets.push(primary);
  if (secondary) secrets.push(secondary);

  return secrets;
}

/**
 * Verifica la firma probando cada signing secret configurado en orden.
 * @returns {import("stripe").Stripe.Event | null}
 */
function verifyStripeWebhookEvent(rawBody, signature) {
  for (const secret of getWebhookSecrets()) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      // Probar el siguiente secret (p. ej. Connect vs cuenta plataforma).
    }
  }
  return null;
}

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecrets = getWebhookSecrets();

  if (!signature || webhookSecrets.length === 0) {
    return NextResponse.json(
      { error: "Firma o secreto de webhook no configurados" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const event = verifyStripeWebhookEvent(rawBody, signature);

  if (!event) {
    console.error("[stripe/webhook] Firma inválida con todos los secrets");
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  let claim;
  try {
    claim = await claimWebhookEvent(event);
  } catch (err) {
    console.error(
      "[stripe/webhook] Error registrando evento:",
      event.id,
      getErrorMessage(err),
    );
    return NextResponse.json(
      { error: "Error al registrar el evento" },
      { status: 500 },
    );
  }

  if (claim.status === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const { handled } = await dispatchEvent(event);
    await markEventProcessed(event.id);

    return NextResponse.json({
      received: true,
      handled,
    });
  } catch (err) {
    console.error(
      "[stripe/webhook] Error procesando evento:",
      event.type,
      getErrorMessage(err),
    );
    await markEventFailed(event.id, err);
    return NextResponse.json(
      { error: "Error al procesar el evento" },
      { status: 500 },
    );
  }
}
