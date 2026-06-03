import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, nombre, customer_id, action } = body;

    if (action === "detach") {
      await stripe.paymentMethods.detach(body.payment_method_id);
      return Response.json({ success: true });
    }

    if (action === "attach") {
      await stripe.paymentMethods.attach(body.payment_method_id, {
        customer: body.customer_id,
      });
      return Response.json({ success: true });
    }

    if (action === "setup_intent") {
      const setupIntent = await stripe.setupIntents.create({
        customer: body.customer_id,
        payment_method_types: ["card"],
      });
      return Response.json({ clientSecret: setupIntent.client_secret });
    }

    if (customer_id) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer_id,
        type: "card",
      });
      return Response.json({
        customer_id,
        paymentMethods: paymentMethods.data,
      });
    }

    const customer = await stripe.customers.create({ email, name: nombre });
    return Response.json({ customer_id: customer.id, paymentMethods: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
