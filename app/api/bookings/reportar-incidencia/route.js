import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  enviarEmailIncidenciaReserva,
  registrarIncidenciaReserva,
} from "@/app/lib/booking-incidencia";

const supabaseAdmin = createServiceClient(
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

  const bookingId = body?.bookingId ?? body?.booking_id;
  const motivo = body?.motivo;
  const comentario = body?.comentario ?? body?.descripcion;

  if (!bookingId) {
    return NextResponse.json({ error: "Falta bookingId" }, { status: 400 });
  }

  if (!comentario?.trim()) {
    return NextResponse.json(
      { error: "Describe el problema antes de enviar." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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
      hora,
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

  const service = booking.services ?? {};
  const isCliente = booking.cliente_id === user.id;
  const isProveedor = service.proveedor_id === user.id;

  if (!isCliente && !isProveedor) {
    return NextResponse.json(
      { error: "No tienes permiso para reportar esta reserva." },
      { status: 403 },
    );
  }

  const reporterRol = isCliente ? "cliente" : "proveedor";

  const result = await registrarIncidenciaReserva(supabaseAdmin, {
    booking,
    service,
    reporterId: user.id,
    reporterRol,
    motivo,
    comentario,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  const { data: reporterProfile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido")
    .eq("id", user.id)
    .maybeSingle();

  const proveedorProfile = service.profiles ?? {};
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  await enviarEmailIncidenciaReserva(baseUrl, {
    booking_id: booking.id,
    reporter_rol: reporterRol,
    reporter_nombre: fullName(reporterProfile),
    servicio_titulo: service.titulo || "Servicio Home&Heart",
    fecha_inicio: booking.fecha_inicio || "—",
    fecha_fin: booking.fecha_fin || booking.fecha_inicio || "—",
    motivo: result.motivoFinal,
    descripcion: result.descripcion,
    proveedor_nombre: fullName(proveedorProfile),
  });

  return NextResponse.json({ success: true, estado: "incidencia" });
}
