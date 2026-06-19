import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: garantiaBookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `
        id,
        cancelado_at,
        services:service_id (
          proveedor_id,
          profiles:proveedor_id (
            nombre,
            apellido,
            penalizacion_valoracion
          )
        )
      `,
    )
    .eq("estado", "cancelada_garantia")
    .gte("cancelado_at", thirtyDaysAgo.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = {};
  for (const booking of garantiaBookings ?? []) {
    const proveedorId = booking.services?.proveedor_id;
    if (!proveedorId) continue;
    if (!grouped[proveedorId]) {
      const perfil = booking.services?.profiles ?? {};
      grouped[proveedorId] = {
        proveedorId,
        nombre:
          [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") ||
          "Proveedor",
        penalizacion: Number(perfil.penalizacion_valoracion) || 0,
        count: 0,
      };
    }
    grouped[proveedorId].count += 1;
  }

  const cancelaciones = Object.values(grouped).sort((a, b) => b.count - a.count);

  return NextResponse.json({ cancelaciones });
}
