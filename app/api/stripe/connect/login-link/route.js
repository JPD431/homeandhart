import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    if (!profile.stripe_account_id) {
      return NextResponse.json(
        { error: "No tienes una cuenta de cobros configurada." },
        { status: 400 },
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_account_id,
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("[login-link] Error:", error.message);
    const message =
      error?.code === "account_invalid" ||
      /not completed|onboarding|login link/i.test(String(error?.message || ""))
        ? "No se pudo abrir el panel de Stripe. Completa el alta de cobros e inténtalo de nuevo."
        : error.message || "Error al abrir el panel de cobros de Stripe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
