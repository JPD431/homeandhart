import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { linkPendingInvitesToProfile } from "@/app/lib/familia-invites";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

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
  if (isExcludedFromUserEmailSequences(user.id, user.email)) {
    return;
  }

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

  try {
    const result = await sendPlatformEmail({
      tipo,
      email: user.email,
      nombre,
      user_id: user.id,
    });
    if (!result.ok) {
      console.error(
        "[auth/callback] Error enviando email bienvenida:",
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[auth/callback] Error enviando email bienvenida:", err);
  }
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

    const profilePayload = {
      id: user.id,
      nombre,
      apellido,
      role,
      codigo_referido: codigoReferidoPropio,
      reservas_sin_comision_cliente: 3,
      reservas_sin_comision_proveedor: 3,
    };

    if (role === "proveedor") {
      profilePayload.onboarding_started_at = new Date().toISOString();
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

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

  // Vincular invitaciones pendientes al perfil (sin activar; el usuario decide en /familia).
  try {
    await linkPendingInvitesToProfile(supabaseAdmin, user.id, user.email);
  } catch (err) {
    console.error("[auth/callback] Error vinculando invitación familia:", err);
  }
}

const OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Origen canónico (evita www vs apex en redirects). */
function getAppOrigin(request) {
  const configured = (process.env.NEXT_PUBLIC_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

function normalizeOtpType(raw) {
  const type = String(raw || "signup").toLowerCase();
  return OTP_TYPES.has(type) ? type : "signup";
}

function successPathForType(type) {
  if (type === "recovery") return "/nueva-contrasena";
  if (type === "email_change") return "/editar-perfil";
  if (type === "magiclink") return "/buscar";
  // signup | invite | email
  return "/verificado";
}

function errorRedirectForType(origin, type) {
  if (type === "recovery") {
    return `${origin}/recuperar-contrasena?error=enlace`;
  }
  if (type === "email_change") {
    return `${origin}/editar-perfil?error=verificacion`;
  }
  return `${origin}/registro?error=verificacion`;
}

function shouldRunSignupSideEffects(type) {
  return type === "signup" || type === "email" || type === "invite";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origin = getAppOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = normalizeOtpType(searchParams.get("type"));

  const successUrl = new URL(successPathForType(otpType), `${origin}/`);
  let response = NextResponse.redirect(successUrl);
  const supabase = createAuthRouteClient(request, response);

  let user = null;
  let authError = null;

  if (code) {
    // Flujo PKCE (legacy / OAuth / plantillas con ConfirmationURL + code)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
    user = data?.user ?? null;
  } else if (tokenHash) {
    // Flujo token_hash (recomendado para emails: no depende del code_verifier)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    authError = error;
    user = data?.user ?? null;
  } else {
    return NextResponse.redirect(`${origin}/registro`);
  }

  if (authError) {
    console.error(
      "[auth/callback] Error verificando email:",
      authError.message,
      { otpType, hasCode: Boolean(code), hasTokenHash: Boolean(tokenHash) },
    );
    return NextResponse.redirect(errorRedirectForType(origin, otpType));
  }

  // verifyOtp / exchangeCodeForSession ya persisten la sesión en cookies
  // vía createAuthRouteClient → response.cookies
  if (shouldRunSignupSideEffects(otpType)) {
    await runPostVerificationSideEffects(user);
  }

  return response;
}
