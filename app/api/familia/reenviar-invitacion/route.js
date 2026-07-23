import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";
import {
  resolverNombreUsuario,
  resolverUserIdPorEmail,
} from "@/app/lib/email-usuario";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reenvía email de invitación familiar pendiente.
 * Solo administrador activo de esa familia.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const invitacionId = body?.invitacion_id;
  if (!invitacionId || typeof invitacionId !== "string") {
    return NextResponse.json(
      { error: "Falta invitacion_id" },
      { status: 400 },
    );
  }

  const { data: invitacion, error: inviteError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id, familia_id, email_invitado, perfil_id, estado")
    .eq("id", invitacionId)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  if (!invitacion || invitacion.estado !== "pendiente") {
    return NextResponse.json(
      { error: "Invitación no encontrada o ya no está pendiente" },
      { status: 404 },
    );
  }

  const email = invitacion.email_invitado?.trim().toLowerCase() || "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "La invitación no tiene un email válido" },
      { status: 400 },
    );
  }

  const { data: adminMembership, error: adminError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id")
    .eq("familia_id", invitacion.familia_id)
    .eq("perfil_id", user.id)
    .eq("rol", "administrador")
    .eq("estado", "activo")
    .maybeSingle();

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  if (!adminMembership) {
    return NextResponse.json(
      { error: "No tienes permiso para reenviar esta invitación" },
      { status: 403 },
    );
  }

  const { data: familiaRow } = await supabaseAdmin
    .from("familias")
    .select("nombre")
    .eq("id", invitacion.familia_id)
    .maybeSingle();

  const invitadorNombre =
    (await resolverNombreUsuario(user.id)) || "Un miembro";
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
  const tieneCuenta =
    !!invitacion.perfil_id || !!(await resolverUserIdPorEmail(email));
  const emailTipo = tieneCuenta
    ? "invitacion_familia_login"
    : "invitacion_familia_registro";
  const accionUrl = tieneCuenta
    ? `${baseUrl}/login?email=${encodeURIComponent(email)}`
    : `${baseUrl}/registro?email=${encodeURIComponent(email)}`;

  const result = await dispatchPlatformEmail({
    tipo: emailTipo,
    destinatario_email: email,
    invitador_nombre: invitadorNombre,
    familia_nombre: familiaRow?.nombre ?? "Home&Heart",
    accion_url: accionUrl,
    aceptar_url: `${baseUrl}/familia?aceptar=${invitacion.id}`,
  });

  if (!result.ok) {
    console.error(
      "[familia/reenviar-invitacion] FALLO email",
      result.status,
      result.error,
    );
    return NextResponse.json(
      { error: result.error || "No se pudo reenviar la invitación" },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
