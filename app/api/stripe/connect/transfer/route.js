import Stripe from "stripe";
import { authorizeAdminOrCron } from "@/app/lib/stripe-api-auth";
import { createStripeTransferWithIdempotency } from "@/app/lib/transfer-proveedor";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const auth = await authorizeAdminOrCron(request);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { paymentIntentId, proveedores } = await request.json();

    if (!paymentIntentId || !Array.isArray(proveedores)) {
      return Response.json(
        { error: "Faltan paymentIntentId o proveedores" },
        { status: 400 },
      );
    }

    const transfers = await Promise.all(
      proveedores.map((p, index) =>
        createStripeTransferWithIdempotency(
          stripe,
          {
            amount: Math.round(p.amount * 100),
            currency: "eur",
            destination: p.stripe_account_id,
            source_transaction: paymentIntentId,
          },
          `transfer:admin-connect:${paymentIntentId}:${p.stripe_account_id}:${index}`,
        ),
      ),
    );

    return Response.json({ success: true, transfers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
