import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolverNombreUsuario,
  resolverUserIdPorEmail,
} from "@/app/lib/email-usuario";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { familia_id: familiaId, email: rawEmail } = body ?? {};

  if (!familiaId) {
    return NextResponse.json(
      { error: "Falta familia_id" },
      { status: 400 },
    );
  }

  const email = rawEmail?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "Indica un email para invitar." },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "El email no tiene un formato válido." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (user.email?.trim().toLowerCase() === email) {
    return NextResponse.json(
      { error: "No puedes invitarte a ti mismo." },
      { status: 400 },
    );
  }

  const { data: adminMembership, error: adminError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id")
    .eq("familia_id", familiaId)
    .eq("perfil_id", user.id)
    .eq("rol", "administrador")
    .eq("estado", "activo")
    .maybeSingle();

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  if (!adminMembership) {
    return NextResponse.json(
      { error: "No tienes permiso para invitar a esta familia" },
      { status: 403 },
    );
  }

  const existingUserId = await resolverUserIdPorEmail(email);

  if (existingUserId === user.id) {
    return NextResponse.json(
      { error: "No puedes invitarte a ti mismo." },
      { status: 400 },
    );
  }

  const { data: miembrosExistentes, error: miembrosError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id, estado, perfil_id, email_invitado")
    .eq("familia_id", familiaId)
    .in("estado", ["activo", "pendiente"]);

  if (miembrosError) {
    return NextResponse.json({ error: miembrosError.message }, { status: 500 });
  }

  const conflicto = (miembrosExistentes ?? []).find((m) => {
    if (existingUserId && m.perfil_id === existingUserId) return true;
    return (
      m.estado === "pendiente" &&
      m.email_invitado?.trim().toLowerCase() === email
    );
  });

  if (conflicto) {
    return NextResponse.json(
      {
        error:
          "Esa persona ya está en el grupo o tiene una invitación pendiente",
      },
      { status: 409 },
    );
  }

  const { data: invitacion, error: inviteError } = await supabaseAdmin
    .from("familia_miembros")
    .insert({
      familia_id: familiaId,
      perfil_id: existingUserId,
      email_invitado: email,
      rol: "miembro",
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const { data: familiaRow } = await supabaseAdmin
    .from("familias")
    .select("nombre")
    .eq("id", familiaId)
    .maybeSingle();

  const invitadorNombre =
    (await resolverNombreUsuario(user.id)) || "Un miembro";
  const baseUrl =
    process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  const familiaNombre = familiaRow?.nombre ?? "Home&Heart";
  const emailTipo = existingUserId
    ? "invitacion_familia_login"
    : "invitacion_familia_registro";
  const accionUrl = existingUserId
    ? `${baseUrl}/login?email=${encodeURIComponent(email)}`
    : `${baseUrl}/registro?email=${encodeURIComponent(email)}`;

  try {
    const result = await sendPlatformEmail({
      tipo: emailTipo,
      destinatario_email: email,
      invitador_nombre: invitadorNombre,
      familia_nombre: familiaNombre,
      accion_url: accionUrl,
      aceptar_url: `${baseUrl}/familia?aceptar=${invitacion.id}`,
    });

    if (!result.ok) {
      console.error(
        "[familia/invitar] Error enviando email de invitación:",
        result.error || result.status,
      );
    }
  } catch (emailErr) {
    console.error(
      "[familia/invitar] Error enviando email de invitación:",
      emailErr,
    );
  }

  return NextResponse.json({
    success: true,
    invitacion_id: invitacion.id,
    perfil_vinculado: !!existingUserId,
  });
}
