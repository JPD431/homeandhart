import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function tryAutoJoinFamiliaInvite(user) {
  if (!user?.id || !user?.email_confirmed_at || !user?.email) return null;

  const email = user.email.trim().toLowerCase();
  if (!email) return null;

  // Seguridad: 1 familia activa por persona. Si ya tiene, no tocar invitaciones.
  const { data: existingMembership, error: membershipError } =
    await supabaseAdmin
      .from("familia_miembros")
      .select("id, familia_id")
      .eq("perfil_id", user.id)
      .eq("estado", "activo")
      .maybeSingle();

  if (membershipError) {
    console.error("[auth/callback] Error leyendo familia_miembros:", membershipError);
    return null;
  }

  if (existingMembership) return null;

  // Busca invitación pendiente por email (puede existir aunque perfil_id sea null).
  const { data: pendingInvite, error: pendingError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id, familia_id, estado, perfil_id, email_invitado, created_at")
    .eq("estado", "pendiente")
    .ilike("email_invitado", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    console.error("[auth/callback] Error buscando invitación pendiente:", pendingError);
    return null;
  }

  if (!pendingInvite?.id) return null;

  // Idempotencia: si ya se vinculó a alguien, no lo reasignamos.
  if (pendingInvite.perfil_id && pendingInvite.perfil_id !== user.id) {
    return null;
  }

  const { error: updateError } = await supabaseAdmin
    .from("familia_miembros")
    .update({
      perfil_id: user.id,
      estado: "activo",
      email_invitado: null,
    })
    .eq("id", pendingInvite.id)
    .eq("estado", "pendiente");

  if (updateError) {
    console.error("[auth/callback] Error activando invitación:", updateError);
    return null;
  }

  const { data: familiaRow } = await supabaseAdmin
    .from("familias")
    .select("id, nombre")
    .eq("id", pendingInvite.familia_id)
    .maybeSingle();

  return {
    invitacionId: pendingInvite.id,
    familiaId: pendingInvite.familia_id,
    familiaNombre: familiaRow?.nombre || null,
  };
}

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
    return { joinedFamilia: null };
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

  // Auto-aceptar invitación a familia por email (caso: invitado sin cuenta).
  let joinedFamilia = null;
  try {
    joinedFamilia = await tryAutoJoinFamiliaInvite(user);
  } catch (err) {
    console.error("[auth/callback] Error en auto-join familia:", err);
  }

  return { joinedFamilia };
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

  const { joinedFamilia } = await runPostVerificationSideEffects(user);

  // Si se unió automáticamente a una familia, llevamos al usuario a /familia con aviso.
  if (joinedFamilia?.familiaId) {
    const next = new URL("/familia", request.url);
    next.searchParams.set("bienvenida", "1");
    if (joinedFamilia.familiaNombre) {
      next.searchParams.set("familia", joinedFamilia.familiaNombre);
    }
    response = NextResponse.redirect(next);
  }

  return response;
}
