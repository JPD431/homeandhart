import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { authorizeAuthenticatedClient, authorizeStripeCustomerAccess } from "@/app/lib/stripe-api-auth";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, nombre, customer_id, action } = body;

    if (action === "detach") {
      const auth = await authorizeStripeCustomerAccess(request, body.customer_id);
      if (!auth.ok) {
        return Response.json({ error: auth.error }, { status: auth.status });
      }

      await stripe.paymentMethods.detach(body.payment_method_id);
      return Response.json({ success: true });
    }

    if (action === "attach") {
      const auth = await authorizeStripeCustomerAccess(request, body.customer_id);
      if (!auth.ok) {
        return Response.json({ error: auth.error }, { status: auth.status });
      }

      await stripe.paymentMethods.attach(body.payment_method_id, {
        customer: body.customer_id,
      });
      return Response.json({ success: true });
    }

    if (action === "setup_intent") {
      const auth = await authorizeStripeCustomerAccess(request, body.customer_id);
      if (!auth.ok) {
        return Response.json({ error: auth.error }, { status: auth.status });
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: body.customer_id,
        payment_method_types: ["card"],
      });
      return Response.json({ clientSecret: setupIntent.client_secret });
    }

    if (customer_id) {
      const auth = await authorizeStripeCustomerAccess(request, customer_id);
      if (!auth.ok) {
        return Response.json({ error: auth.error }, { status: auth.status });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer_id,
        type: "card",
      });
      return Response.json({
        customer_id,
        paymentMethods: paymentMethods.data,
      });
    }

    const auth = await authorizeAuthenticatedClient(request);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const customerEmail = email || user?.email;
    if (!customerEmail) {
      return Response.json(
        { error: "Se necesita un email para crear el cliente de pago." },
        { status: 400 },
      );
    }

    const customer = await stripe.customers.create({
      email: customerEmail,
      name: nombre,
      metadata: { profile_id: user.id },
    });

    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", user.id);

    return Response.json({ customer_id: customer.id, paymentMethods: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
