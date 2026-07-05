import Stripe from "stripe";
import { authorizePaymentIntentOwner } from "@/app/lib/stripe-api-auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { paymentIntentId } = await request.json();

    if (!paymentIntentId) {
      return Response.json({ error: "Falta paymentIntentId" }, { status: 400 });
    }

    const auth = await authorizePaymentIntentOwner(request, paymentIntentId, stripe);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return Response.json({ success: true, paymentIntent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
