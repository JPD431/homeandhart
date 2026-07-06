import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  ejecutarReembolsoTotalIncidencia,
  enviarEmailReembolsoIncidencia,
} from "@/app/lib/incidencia-reembolso-total";
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
  credito_aplicado,
  resolucion_tipo,
  resolucion_at,
  services:service_id (
    titulo,
    profiles:proveedor_id (nombre, apellido)
  )
`;

export async function POST(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const bookingId = body?.bookingId;
  const nota = typeof body?.nota === "string" ? body.nota : undefined;

  if (!bookingId) {
    return NextResponse.json({ error: "Falta bookingId" }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const result = await ejecutarReembolsoTotalIncidencia(
    supabaseAdmin,
    booking,
    admin.id,
    nota,
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, stripe: result.stripe, reembolso: result.reembolso },
      { status: result.status || 500 },
    );
  }

  if (!result.already_processed) {
    await enviarEmailReembolsoIncidencia(
      booking,
      booking.services,
      result.reembolso,
    );
  }

  return NextResponse.json(result);
}
