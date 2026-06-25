import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const runtime = "nodejs";

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

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Firma o secreto de webhook no configurados" },
      { status: 400 },
    );
  }

  let event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Firma inválida:", err.message);
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
