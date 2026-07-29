import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * GET /api/admin/suspensiones-cautelares
 * Lista proveedores suspendidos + reservas con revision_seguridad_pendiente.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: suspended, error: suspendedError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, nombre, apellido, role, suspendido_cautelar, suspendido_cautelar_at, suspendido_cautelar_por, suspendido_cautelar_motivo, suspendido_cautelar_report_id, verificado, rechazado, motivo_rechazo",
    )
    .eq("suspendido_cautelar", true)
    .order("suspendido_cautelar_at", { ascending: false });

  if (suspendedError) {
    return NextResponse.json({ error: suspendedError.message }, { status: 500 });
  }

  const providers = suspended ?? [];
  const reportIds = providers
    .map((p) => p.suspendido_cautelar_report_id)
    .filter(Boolean);
  const providerIds = providers.map((p) => p.id);

  let reportsById = {};
  if (reportIds.length > 0) {
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from("reports")
      .select(
        "id, motivo, descripcion, estado, tipo, created_at, reporter_id, reported_id, booking_id",
      )
      .in("id", reportIds);

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }
    reportsById = Object.fromEntries((reports ?? []).map((r) => [r.id, r]));
  }

  let bookingsByProvider = {};
  let orphanBookings = [];

  const { data: flaggedBookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      estado,
      fecha_inicio,
      fecha_fin,
      hora,
      precio_total,
      revision_seguridad_pendiente,
      cliente_id,
      service_id,
      services:service_id (
        id,
        titulo,
        vertical,
        proveedor_id
      )
    `,
    )
    .eq("revision_seguridad_pendiente", true)
    .order("fecha_inicio", { ascending: true });

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  for (const booking of flaggedBookings ?? []) {
    const proveedorId = booking.services?.proveedor_id;
    const row = {
      id: booking.id,
      estado: booking.estado,
      fecha_inicio: booking.fecha_inicio,
      fecha_fin: booking.fecha_fin,
      hora: booking.hora,
      precio_total: booking.precio_total,
      cliente_id: booking.cliente_id,
      service_id: booking.service_id,
      servicio_titulo: booking.services?.titulo || "Servicio",
      vertical: booking.services?.vertical || null,
      proveedor_id: proveedorId || null,
    };
    if (proveedorId && providerIds.includes(proveedorId)) {
      if (!bookingsByProvider[proveedorId]) bookingsByProvider[proveedorId] = [];
      bookingsByProvider[proveedorId].push(row);
    } else {
      orphanBookings.push(row);
    }
  }

  const enriched = await Promise.all(
    providers.map(async (p) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
      const report = p.suspendido_cautelar_report_id
        ? reportsById[p.suspendido_cautelar_report_id] || null
        : null;
      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        email: authUser?.user?.email || null,
        verificado: p.verificado === true,
        rechazado: p.rechazado === true,
        motivo_rechazo: p.motivo_rechazo || null,
        suspendido_cautelar_at: p.suspendido_cautelar_at,
        suspendido_cautelar_por: p.suspendido_cautelar_por,
        suspendido_cautelar_motivo: p.suspendido_cautelar_motivo,
        suspendido_cautelar_report_id: p.suspendido_cautelar_report_id,
        reporte: report,
        reservas_revision: bookingsByProvider[p.id] ?? [],
      };
    }),
  );

  return NextResponse.json({
    suspensiones: enriched,
    reservas_huerfanas: orphanBookings,
    meta: {
      total_suspendidos: enriched.length,
      total_reservas_revision:
        (flaggedBookings ?? []).length,
    },
  });
}
