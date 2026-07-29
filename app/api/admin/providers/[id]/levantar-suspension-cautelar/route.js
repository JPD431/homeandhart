import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { levantarSuspensionCautelar } from "@/app/lib/suspension-cautelar";

/**
 * POST /api/admin/providers/[id]/levantar-suspension-cautelar
 */
export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await levantarSuspensionCautelar(id, admin.id);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo levantar la suspensión" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    already_clear: result.already_clear === true,
  });
}
