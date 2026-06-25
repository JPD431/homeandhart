import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function createAuthRouteClient(request, response) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}

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

async function runPostVerificationSideEffects(user) {
  if (!user?.email_confirmed_at || !user.email) {
    return;
  }

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const nombre = user.user_metadata?.nombre || user.email.split("@")[0];
    const apellido = user.user_metadata?.apellido || "";
    const role = user.user_metadata?.role || "cliente";
    const codigoReferidoPropio =
      "HH-" +
      nombre
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 4)
        .padEnd(4, "X") +
      Math.floor(Math.random() * 9000 + 1000);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nombre,
          apellido,
          role,
          codigo_referido: codigoReferidoPropio,
          reservas_sin_comision_cliente: 3,
          reservas_sin_comision_proveedor: 3,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("Error creando perfil:", profileError);
    } else {
      console.log("Perfil creado correctamente para:", user.email);
    }
  }

  const codigoReferido =
    typeof user.user_metadata?.codigo_referido === "string"
      ? user.user_metadata.codigo_referido.trim()
      : "";

  if (codigoReferido) {
    const { data: perfilActual, error: perfilError } = await supabaseAdmin
      .from("profiles")
      .select("referido_por")
      .eq("id", user.id)
      .maybeSingle();

    if (!perfilError && perfilActual && !perfilActual.referido_por) {
      const { data: referidor, error: referidorError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("codigo_referido", codigoReferido)
        .maybeSingle();

      if (!referidorError && referidor && referidor.id !== user.id) {
        const { error: linkError } = await supabaseAdmin
          .from("profiles")
          .update({ referido_por: referidor.id })
          .eq("id", user.id)
          .is("referido_por", null);

        if (linkError) {
          console.error("[auth/callback] Error guardando referido_por:", linkError);
        }
      }
    }
  }

  try {
    await sendWelcomeEmail(user);
  } catch {
    /* no bloquear redirect si falla el email */
  }
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");

  const verificadoUrl = new URL("/verificado", request.url);
  let response = NextResponse.redirect(verificadoUrl);
  const supabase = createAuthRouteClient(request, response);

  let user = null;
  let authError = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
    user = data?.user ?? null;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });
    authError = error;
    user = data?.user ?? null;
  } else {
    return NextResponse.redirect(`${origin}/registro`);
  }

  if (authError) {
    console.error("[auth/callback] Error verificando email:", authError.message);
    return NextResponse.redirect(`${origin}/registro?error=verificacion`);
  }

  await runPostVerificationSideEffects(user);

  return response;
}
