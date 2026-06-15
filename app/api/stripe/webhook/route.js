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

  try {
    if (event.type === "account.updated") {
      await handleAccountUpdated(event.data.object);
    }
  } catch (err) {
    console.error("[stripe/webhook] Error procesando evento:", event.type, err.message);
    return NextResponse.json(
      { error: "Error al procesar el evento" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
