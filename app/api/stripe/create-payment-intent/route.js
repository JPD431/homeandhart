import Stripe from "stripe";
import { authorizeAuthenticatedClient } from "@/app/lib/stripe-api-auth";
import { assertUserIsDniVerified } from "@/app/lib/dni";
import { assertUserHasTelefono } from "@/app/lib/profile-telefono";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    if (!clienteId) {
      return Response.json(
        { error: "Falta metadata.cliente_id en la retención de pago." },
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

    const intentParams = {
      amount: Math.round(amount * 100),
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
