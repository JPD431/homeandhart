import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createOnboardingLink(accountId) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard?stripe=refresh`,
    return_url: `${baseUrl}/dashboard?stripe=success`,
    type: "account_onboarding",
  });
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene email asociado" },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "No se encontró el perfil del proveedor" },
        { status: 404 },
      );
    }

    if (profile.stripe_account_id) {
      const accountLink = await createOnboardingLink(profile.stripe_account_id);
      return NextResponse.json({
        url: accountLink.url,
        accountId: profile.stripe_account_id,
        existing: true,
      });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "ES",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { proveedor_id: user.id },
    });

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ stripe_account_id: account.id })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "No se pudo guardar la cuenta de cobro en el perfil" },
        { status: 500 },
      );
    }

    const accountLink = await createOnboardingLink(account.id);

    return NextResponse.json({
      url: accountLink.url,
      accountId: account.id,
      existing: false,
    });
  } catch (error) {
    console.error("[create-account] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Error al configurar cobros con Stripe" },
      { status: 500 },
    );
  }
}
