import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { loadAdminServiceForPreview } from "@/app/lib/public-service";

/**
 * GET /api/admin/servicios/[serviceId]/preview
 *
 * Vista previa de moderación de cualquier servicio (incl. borrador / en_revision).
 * Solo ADMIN_USER_IDS. Carga con service role (no depende de RLS de services).
 */
export async function GET(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const service = await loadAdminServiceForPreview(serviceId);
  if (!service) {
    return NextResponse.json(
      { error: "Servicio no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "admin-preview",
    service,
  });
}
