import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { paymentIntentId, proveedores } = await request.json();
    // proveedores = [{ stripe_account_id, amount }]

    const transfers = await Promise.all(
      proveedores.map((p) =>
        stripe.transfers.create({
          amount: Math.round(p.amount * 100),
          currency: "eur",
          destination: p.stripe_account_id,
          source_transaction: paymentIntentId,
        }),
      ),
    );

    return Response.json({ success: true, transfers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
