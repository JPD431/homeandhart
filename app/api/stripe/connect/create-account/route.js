import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { email, proveedor_id } = await request.json();

    const account = await stripe.accounts.create({
      type: "express",
      country: "ES",
      email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { proveedor_id },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?stripe=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?stripe=success`,
      type: "account_onboarding",
    });

    return Response.json({ url: accountLink.url, accountId: account.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
