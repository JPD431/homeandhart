import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { MOTIVOS_REPORTE_PERFIL } from "@/app/lib/report-severity";
import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";
import { maybeSuspenderPorReporteGrave } from "@/app/lib/suspension-cautelar";
import { resolverNombreUsuario } from "@/app/lib/email-usuario";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TIPOS_VALIDOS = new Set(["proveedor", "cliente", "servicio"]);

/**
 * POST /api/reports
 * Crea un reporte autenticado (perfil / genérico). Suspensión cautelar si grave + proveedor.
 */
export async function POST(request) {
  const supabase = await createServerClient();
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

  const reportedId =
    typeof body?.reported_id === "string" ? body.reported_id.trim() : "";
  const tipo = typeof body?.tipo === "string" ? body.tipo.trim() : "";
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  const descripcion =
    typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
  const bookingId =
    typeof body?.booking_id === "string" && body.booking_id.trim()
      ? body.booking_id.trim()
      : null;
  const reportedName =
    typeof body?.reported_name === "string" ? body.reported_name.trim() : "";
  const fechaInicio = body?.fecha_inicio || null;
  const fechaFin = body?.fecha_fin || null;

  if (!reportedId) {
    return NextResponse.json({ error: "Falta reported_id" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  if (!MOTIVOS_REPORTE_PERFIL.includes(motivo)) {
    return NextResponse.json({ error: "Motivo no válido" }, { status: 400 });
  }
  if (!descripcion) {
    return NextResponse.json(
      { error: "Describe el problema antes de enviar." },
      { status: 400 },
    );
  }
  if (reportedId === user.id) {
    return NextResponse.json(
      { error: "No puedes reportarte a ti mismo" },
      { status: 400 },
    );
  }

  const { data: reportedProfile, error: reportedError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, nombre, apellido")
    .eq("id", reportedId)
    .maybeSingle();

  if (reportedError) {
    return NextResponse.json({ error: reportedError.message }, { status: 500 });
  }
  if (!reportedProfile) {
    return NextResponse.json(
      { error: "Usuario reportado no encontrado" },
      { status: 404 },
    );
  }

  const { data: hasServices } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("proveedor_id", reportedId)
    .limit(1);

  const reportedIsProveedor =
    reportedProfile.role === "proveedor" ||
    tipo === "proveedor" ||
    (hasServices?.length ?? 0) > 0;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_id: reportedId,
      booking_id: bookingId,
      tipo,
      motivo,
      descripcion,
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const reporterNombre =
    (await resolverNombreUsuario(user.id)) || "Usuario";
  const reportedDisplay =
    reportedName ||
    [reportedProfile.nombre, reportedProfile.apellido]
      .filter(Boolean)
      .join(" ") ||
    "—";

  const notify = await dispatchPlatformEmail({
    tipo: "incidencia",
    booking_id: bookingId || "—",
    cliente_nombre: reporterNombre,
    fecha_inicio: fechaInicio || "—",
    fecha_fin: fechaFin || fechaInicio || "—",
    descripcion: `Nuevo reporte (${tipo})\nMotivo: ${motivo}\nReportado: ${reportedDisplay}\n\n${descripcion}`,
  });

  if (!notify.ok) {
    console.error(
      "[api/reports] FALLO email notify:",
      notify.status,
      notify.error,
    );
  }

  let suspension = null;
  if (reportedIsProveedor) {
    const susp = await maybeSuspenderPorReporteGrave({
      reportedId,
      motivo,
      reportId: inserted.id,
      reportedIsProveedor: true,
    });
    suspension = susp;
  }

  return NextResponse.json({
    success: true,
    report_id: inserted.id,
    suspension_aplicada: suspension?.applied === true,
    already_suspended: suspension?.result?.already_suspended === true,
  });
}
