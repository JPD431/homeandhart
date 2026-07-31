import Stripe from "stripe";
import { authorizeAuthenticatedClient } from "@/app/lib/stripe-api-auth";
import { assertUserIsDniVerified } from "@/app/lib/dni";
import { assertUserHasTelefono } from "@/app/lib/profile-telefono";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/app/lib/rate-limit";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** Mínimo de Stripe para cargos EUR (manual capture / holds). */
const MIN_AMOUNT_EUR = 0.5;
/** Tope de sanidad: evita holds gigantes por manipulación del body. */
const MAX_AMOUNT_EUR = 50_000;

export async function POST(request) {
  try {
    const {
      amount,
      currency = "eur",
      metadata,
      customer,
      payment_method,
      confirm_saved,
      setup_future_usage,
    } = await request.json();

    const clienteId = metadata?.cliente_id;
    const auth = await authorizeAuthenticatedClient(request, { clienteId });
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    // Crons internos no se rate-limitan; clientes sí (15/min).
    if (auth.source !== "cron") {
      const limited = await enforceRateLimit(request, {
        limit: 15,
        window: "1 m",
        prefix: "create-payment-intent",
        userId: auth.user?.id || clienteId,
      });
      if (limited) return limited;
    }

    if (!clienteId) {
      return Response.json(
        { error: "Falta metadata.cliente_id en la retención de pago." },
        { status: 400 },
      );
    }

    const amountEur = Number(amount);
    if (!Number.isFinite(amountEur)) {
      return Response.json(
        { error: "Importe de retención inválido." },
        { status: 400 },
      );
    }

    const amountCents = Math.round(amountEur * 100);
    if (amountCents < Math.round(MIN_AMOUNT_EUR * 100)) {
      return Response.json(
        {
          error: `El importe mínimo de retención es ${MIN_AMOUNT_EUR.toFixed(2).replace(".", ",")}€.`,
        },
        { status: 400 },
      );
    }
    if (amountCents > Math.round(MAX_AMOUNT_EUR * 100)) {
      return Response.json(
        {
          error: `El importe de retención supera el máximo permitido (${MAX_AMOUNT_EUR.toLocaleString("es-ES")}€).`,
        },
        { status: 400 },
      );
    }

    const dniCheck = await assertUserIsDniVerified(supabaseAdmin, clienteId);
    if (!dniCheck.ok) {
      return Response.json(dniCheck.body, { status: dniCheck.status });
    }

    const telefonoCheck = await assertUserHasTelefono(supabaseAdmin, clienteId);
    if (!telefonoCheck.ok) {
      return Response.json(telefonoCheck.body, {
        status: telefonoCheck.status,
      });
    }

    // El amount sigue viniendo del cliente (tarjeta tras crédito, por servicio).
    // complete recalcula desde BD y rechaza si no cuadra ±2¢ (autoritativo).
    const intentParams = {
      amount: amountCents,
      currency,
      capture_method: "manual",
      metadata,
    };

    if (customer) intentParams.customer = customer;

    if (setup_future_usage) {
      intentParams.setup_future_usage = setup_future_usage;
    }

    if (confirm_saved && customer && payment_method) {
      intentParams.payment_method = payment_method;
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
