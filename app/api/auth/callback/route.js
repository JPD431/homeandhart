import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

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
  console.log("CALLBACK URL:", request.url);
  console.log("searchParams:", Object.fromEntries(searchParams));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  console.log("code:", code);
  console.log("tokenHash:", tokenHash);
  console.log("type:", type);

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
            reservas_sin_comision: 3,
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

    const codigoReferido = user.user_metadata?.codigo_referido;

    if (codigoReferido) {
      const { data: perfilActual } = await supabaseAdmin
        .from("profiles")
        .select("referido_aplicado")
        .eq("id", user.id)
        .maybeSingle();

      if (perfilActual && !perfilActual.referido_aplicado) {
        const { data: referidor } = await supabaseAdmin
          .from("profiles")
          .select(
            "id, reservas_sin_comision_cliente, reservas_sin_comision, referidos_count",
          )
          .eq("codigo_referido", codigoReferido)
          .maybeSingle();

        if (referidor) {
          await supabaseAdmin
            .from("profiles")
            .update({
              reservas_sin_comision_cliente: 4,
              reservas_sin_comision: 4,
              referido_aplicado: true,
            })
            .eq("id", user.id);

          const referidorClienteActual =
            Number(referidor.reservas_sin_comision_cliente) ||
            Number(referidor.reservas_sin_comision) ||
            0;
          const referidorClienteNuevo = referidorClienteActual + 1;

          await supabaseAdmin
            .from("profiles")
            .update({
              reservas_sin_comision_cliente: referidorClienteNuevo,
              reservas_sin_comision: referidorClienteNuevo,
              referidos_count: (Number(referidor.referidos_count) || 0) + 1,
            })
            .eq("id", referidor.id);
        }
      }
    }

    try {
      await sendWelcomeEmail(user);
    } catch {
      /* no bloquear redirect si falla el email */
    }
  }

  return NextResponse.redirect(new URL("/verificado", request.url));
}
