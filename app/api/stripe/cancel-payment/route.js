import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { paymentIntentId } = await request.json();
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return Response.json({ success: true, paymentIntent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
