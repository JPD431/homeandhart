import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { suspenderProveedorCautelar } from "@/app/lib/suspension-cautelar";

/**
 * POST /api/admin/providers/[id]/suspender-cautelar
 * Suspensión manual por admin (sin reporte requerido).
 * Body: { motivo: string }
 */
export async function POST(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo || motivo.length < 5) {
    return NextResponse.json(
      { error: "Indica un motivo (mín. 5 caracteres)" },
      { status: 400 },
    );
  }

  const result = await suspenderProveedorCautelar(id, {
    motivo,
    reportId: null,
    por: admin.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo suspender" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    already_suspended: result.already_suspended === true,
    servicios_pausados: result.servicios_pausados ?? 0,
    reservas_marcadas: result.reservas_marcadas ?? 0,
  });
}
