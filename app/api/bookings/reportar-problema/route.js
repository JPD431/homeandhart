import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";
import {
  enviarEmailIncidenciaReserva,
} from "@/app/lib/booking-incidencia-email";
import {
  registrarIncidenciaReserva,
} from "@/app/lib/booking-incidencia";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || "Usuario";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { bookingId, token, comentario } = body ?? {};

  if (!bookingId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      cliente_id,
      service_id,
      estado,
      fecha_inicio,
      fecha_fin,
      payment_intent_id,
      services:service_id (
        titulo,
        proveedor_id,
        profiles!proveedor_id (nombre, apellido)
      )
    `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  // Token HMAC atado a bookingId + paymentIntentId + expiración.
  if (
    !verificarTokenConfirmacion(
      bookingId,
      booking.payment_intent_id || "",
      token,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = booking.services ?? {};
  const motivo = "Incidencia reportada tras el servicio (email)";

  const result = await registrarIncidenciaReserva(supabaseAdmin, {
    booking,
    service,
    reporterId: booking.cliente_id,
    reporterRol: "cliente",
    motivo,
    comentario,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  const { data: clienteProfile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido")
    .eq("id", booking.cliente_id)
    .maybeSingle();

  const proveedorProfile = service.profiles ?? {};
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  await enviarEmailIncidenciaReserva(baseUrl, {
    booking_id: booking.id,
    reporter_rol: "cliente",
    reporter_nombre: fullName(clienteProfile),
    servicio_titulo: service.titulo || "Servicio Home&Heart",
    fecha_inicio: booking.fecha_inicio || "—",
    fecha_fin: booking.fecha_fin || booking.fecha_inicio || "—",
    motivo: result.motivoFinal,
    descripcion: result.descripcion,
    proveedor_nombre: fullName(proveedorProfile),
  });

  return NextResponse.json({ success: true });
}
