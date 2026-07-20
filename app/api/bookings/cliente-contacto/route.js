/**
 * Contacto del cliente para el proveedor de la reserva.
 * Solo confirmada / en_curso / completada.
 * Teléfono: profiles (service role, tras verificar ownership).
 * Dirección: booking_contact_cliente.
 */

import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canShowProviderContact } from "@/app/lib/booking-display";
import { shouldShowClienteDireccionToProvider } from "@/app/lib/lugar-servicio";

function getAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * GET ?ids=uuid,uuid
 * Returns { contacts: { [bookingId]: { telefono, direccion_cliente, direccion_cliente_a_definir, lugar_servicio } } }
 */
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get("ids") || "";
  const bookingIds = [
    ...new Set(
      idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);

  if (bookingIds.length === 0) {
    return NextResponse.json({ contacts: {} });
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Configuración incompleta" }, { status: 500 });
  }

  const { data: bookings, error: bookingsError } = await admin
    .from("bookings")
    .select(
      "id, cliente_id, service_id, estado, lugar_servicio, direccion_cliente_a_definir, services:service_id (proveedor_id, modalidad)",
    )
    .in("id", bookingIds);

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  const allowed = (bookings ?? []).filter((b) => {
    const svc = Array.isArray(b.services) ? b.services[0] : b.services;
    return (
      svc?.proveedor_id === user.id && canShowProviderContact(b.estado)
    );
  });

  if (allowed.length === 0) {
    return NextResponse.json({ contacts: {} });
  }

  const clienteIds = [...new Set(allowed.map((b) => b.cliente_id).filter(Boolean))];
  const allowedIds = allowed.map((b) => b.id);

  const [{ data: profiles }, { data: contactRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, telefono")
      .in("id", clienteIds),
    admin
      .from("booking_contact_cliente")
      .select("booking_id, direccion_cliente")
      .in("booking_id", allowedIds),
  ]);

  const telefonoByCliente = new Map(
    (profiles ?? []).map((p) => [p.id, p.telefono || null]),
  );
  const direccionByBooking = new Map(
    (contactRows ?? []).map((r) => [r.booking_id, r.direccion_cliente || null]),
  );

  const contacts = {};
  for (const b of allowed) {
    const svc = Array.isArray(b.services) ? b.services[0] : b.services;
    const showDir = shouldShowClienteDireccionToProvider(
      b.lugar_servicio,
      svc?.modalidad,
    );
    contacts[b.id] = {
      telefono: telefonoByCliente.get(b.cliente_id) || null,
      lugar_servicio: b.lugar_servicio ?? null,
      direccion_cliente_a_definir: showDir
        ? b.direccion_cliente_a_definir === true
        : null,
      direccion_cliente: showDir
        ? direccionByBooking.get(b.id) || null
        : null,
    };
  }

  return NextResponse.json({ contacts });
}
