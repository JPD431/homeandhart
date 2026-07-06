import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildBundleInfo,
  fetchStripePaymentIntentSummary,
  mapIncidenciaRow,
} from "@/app/lib/admin-incidencias";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BOOKING_SELECT = `
  id,
  cliente_id,
  service_id,
  estado,
  payment_intent_id,
  precio_total,
  precio_base,
  credito_aplicado,
  cliente_sin_comision,
  proveedor_sin_comision,
  pago_liberado_at,
  importe_transferido,
  fecha_inicio,
  fecha_fin,
  hora,
  created_at,
  completada_at,
  comentario_problema,
  confirmacion_cliente,
  profiles_public:cliente_id (nombre, apellido),
  services:service_id (
    titulo,
    vertical,
    ciudad,
    proveedor_id,
    profiles_public:proveedor_id (nombre, apellido)
  )
`;

async function loadReports(bookingId) {
  const { data } = await supabaseAdmin
    .from("reports")
    .select(
      `
      id,
      motivo,
      descripcion,
      estado,
      created_at,
      reporter_id,
      reporter:profiles_public!reporter_id (nombre, apellido)
    `,
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function GET(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { bookingId } = await params;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (booking.estado !== "incidencia") {
    return NextResponse.json(
      { error: "Esta reserva no está en estado incidencia." },
      { status: 400 },
    );
  }

  const reports = await loadReports(bookingId);
  const primaryReport =
    reports.find((r) => r.estado === "pendiente") ?? reports[0] ?? null;

  const [stripePi, bundleInfo] = await Promise.all([
    fetchStripePaymentIntentSummary(booking.payment_intent_id),
    buildBundleInfo(supabaseAdmin, booking),
  ]);

  const incidencia = mapIncidenciaRow(booking, primaryReport, stripePi, bundleInfo);

  return NextResponse.json({
    incidencia: {
      ...incidencia,
      comentario_problema: booking.comentario_problema,
      confirmacion_cliente: booking.confirmacion_cliente,
      reportes_historial: reports.map((report) => ({
        id: report.id,
        motivo: report.motivo,
        descripcion: report.descripcion,
        estado: report.estado,
        created_at: report.created_at,
        reporter_nombre: [report.reporter?.nombre, report.reporter?.apellido]
          .filter(Boolean)
          .join(" "),
      })),
    },
  });
}
