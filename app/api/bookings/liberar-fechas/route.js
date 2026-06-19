import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS_LIBERABLES = new Set([
  "cancelada",
  "cancelada_garantia",
  "cancelada_proveedor",
  "rechazada",
]);

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { booking_id } = body ?? {};

    if (!booking_id || typeof booking_id !== "string") {
      return NextResponse.json({ error: "Falta booking_id" }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, cliente_id, service_id, estado")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (!ESTADOS_LIBERABLES.has(booking.estado)) {
      return NextResponse.json(
        { error: "La reserva no está en un estado que permita liberar fechas" },
        { status: 403 },
      );
    }

    const isCliente = booking.cliente_id === user.id;
    let isProveedor = false;

    if (!isCliente && booking.service_id) {
      const { data: service, error: serviceError } = await supabaseAdmin
        .from("services")
        .select("proveedor_id")
        .eq("id", booking.service_id)
        .maybeSingle();

      if (serviceError) {
        return NextResponse.json({ error: serviceError.message }, { status: 500 });
      }

      isProveedor = service?.proveedor_id === user.id;
    }

    if (!isCliente && !isProveedor) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("disponibilidad")
      .delete()
      .eq("booking_id", booking_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[bookings/liberar-fechas]", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 },
    );
  }
}
