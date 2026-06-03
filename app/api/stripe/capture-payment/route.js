import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { paymentIntentId, proveedores } = await request.json();

    if (!paymentIntentId) {
      return Response.json(
        { error: "Falta paymentIntentId" },
        { status: 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    const chargeId = paymentIntent.latest_charge;

    let transfers = [];
    if (proveedores?.length && chargeId) {
      transfers = await Promise.all(
        proveedores.map((p) =>
          stripe.transfers.create({
            amount: Math.round(p.amount * 100),
            currency: "eur",
            destination: p.stripe_account_id,
            source_transaction: chargeId,
          }),
        ),
      );
    }

    return Response.json({ success: true, paymentIntent, transfers });
  } catch (error) {
    console.error("Error capture-payment:", error.message, error.type, error.code);
    return Response.json(
      { error: error.message, type: error.type, code: error.code },
      { status: 500 },
    );
  }
}
