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
  updated_at,
  profiles_public:cliente_id (nombre, apellido),
  services:service_id (
    titulo,
    vertical,
    ciudad,
    proveedor_id,
    profiles_public:proveedor_id (nombre, apellido)
  )
`;

async function loadPendingReport(bookingId) {
  const { data: report } = await supabaseAdmin
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
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (report) return report;

  const { data: latestReport } = await supabaseAdmin
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestReport ?? null;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("estado", "incidencia")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const incidencias = [];

  for (const booking of bookings ?? []) {
    const [report, stripePi, bundleInfo] = await Promise.all([
      loadPendingReport(booking.id),
      fetchStripePaymentIntentSummary(booking.payment_intent_id),
      buildBundleInfo(supabaseAdmin, booking),
    ]);

    incidencias.push(mapIncidenciaRow(booking, report, stripePi, bundleInfo));
  }

  return NextResponse.json({ incidencias });
}
