import Stripe from "stripe";

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

    const intentParams = {
      amount: Math.round(amount * 100), // Stripe trabaja en céntimos
      currency,
      capture_method: "manual", // Retención — no cobrar hasta confirmar
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
