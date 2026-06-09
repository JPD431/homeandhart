import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sendWelcomeEmail(user) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || user.user_metadata?.role || "cliente";
  const nombre = profile?.nombre || user.user_metadata?.nombre || "";
  const tipo = role === "proveedor" ? "proveedor_bienvenida" : "cliente_bienvenida";

  const { data: existingLog } = await supabaseAdmin
    .from("email_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("tipo", tipo)
    .maybeSingle();

  if (existingLog) return;

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  await fetch(`${baseUrl}/api/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo,
      email: user.email,
      nombre,
      user_id: user.id,
    }),
  });
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  let user = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/registro?error=verificacion`);
    }
    user = data.user;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/registro?error=verificacion`);
    }
    user = data.user;
  } else {
    return NextResponse.redirect(`${origin}/registro`);
  }

  if (user?.email_confirmed_at && user.email) {
    try {
      await sendWelcomeEmail(user);
    } catch {
      /* no bloquear redirect si falla el email */
    }
  }

  return NextResponse.redirect(new URL("/verificado", request.url));
}
