import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { REVISION_RECHAZADO } from "@/app/lib/onboarding-persist";
import { suspenderProveedorCautelar } from "@/app/lib/suspension-cautelar";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/admin/providers/[id]/expulsar-suspension-cautelar
 * Confirma el reporte grave: mantiene/asegura suspensión + rechaza cuenta
 * (sin columna "baneado" nueva: reutiliza rechazado + suspendido_cautelar).
 * Body: { motivo?: string }
 */
export async function POST(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const motivoExtra =
    typeof body?.motivo === "string" ? body.motivo.trim() : "";

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, role, suspendido_cautelar, suspendido_cautelar_motivo, suspendido_cautelar_report_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  if (profile.suspendido_cautelar !== true) {
    const susp = await suspenderProveedorCautelar(id, {
      motivo: motivoExtra || "Expulsión confirmada por admin",
      reportId: null,
      por: admin.id,
    });
    if (!susp.ok) {
      return NextResponse.json(
        { error: susp.error || "No se pudo suspender antes de expulsar" },
        { status: 400 },
      );
    }
  }

  const motivoRechazo =
    motivoExtra ||
    profile.suspendido_cautelar_motivo ||
    "Expulsión tras confirmación de reporte grave / suspensión cautelar";

  const { error: rejectError } = await supabaseAdmin
    .from("profiles")
    .update({
      verificado: false,
      rechazado: true,
      motivo_rechazo: motivoRechazo,
    })
    .eq("id", id);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 500 });
  }

  const { error: servicesError } = await supabaseAdmin
    .from("services")
    .update({ disponible: false, revision_estado: REVISION_RECHAZADO })
    .eq("proveedor_id", id);

  if (servicesError) {
    console.error(
      "[expulsar-suspension] servicios:",
      servicesError.message,
    );
  }

  return NextResponse.json({
    ok: true,
    expulsado: true,
    suspendido_cautelar: true,
    rechazado: true,
  });
}
