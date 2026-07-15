import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { runCronDiario } from "@/app/lib/cron/diario";

/**
 * Disparo manual del cron diario (misma lógica que GET /api/cron/diario).
 * Solo admin autenticado (ADMIN_USER_IDS).
 */
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const payload = await runCronDiario();
    return NextResponse.json({
      ...payload,
      triggered_by: admin.id,
    });
  } catch (err) {
    console.error("[admin/run-cron]", err?.message ?? err);
    return NextResponse.json(
      { error: err?.message || "Error al ejecutar el cron diario" },
      { status: 500 },
    );
  }
}
