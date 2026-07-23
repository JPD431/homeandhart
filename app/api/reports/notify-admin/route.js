import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import { resolverNombreUsuario } from "@/app/lib/email-usuario";

/**
 * Aviso admin tras un reporte creado por el usuario autenticado.
 * No acepta destinatarios arbitrarios; el email va a ADMIN_EMAIL vía tipo incidencia.
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

  const tipo = body?.tipo;
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  const descripcion =
    typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
  const reportedName =
    typeof body?.reported_name === "string" ? body.reported_name.trim() : "";
  const bookingId = body?.booking_id || null;
  const fechaInicio = body?.fecha_inicio || null;
  const fechaFin = body?.fecha_fin || null;

  if (!motivo || !descripcion) {
    return NextResponse.json(
      { error: "Faltan motivo o descripción" },
      { status: 400 },
    );
  }

  const reporterNombre =
    (await resolverNombreUsuario(user.id)) || "Usuario";

  const result = await sendPlatformEmail({
    tipo: "incidencia",
    booking_id: bookingId || "—",
    cliente_nombre: reporterNombre,
    fecha_inicio: fechaInicio || "—",
    fecha_fin: fechaFin || fechaInicio || "—",
    descripcion: `Nuevo reporte (${tipo || "—"})\nMotivo: ${motivo}\nReportado: ${reportedName || "—"}\n\n${descripcion}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo notificar" },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
