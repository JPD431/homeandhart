// -- ALTER TABLE services ADD COLUMN IF NOT EXISTS proveedor_emergencia boolean DEFAULT false;
// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estado_garantia text;
// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelado_at timestamp with time zone;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS penalizacion_valoracion numeric DEFAULT 0;

export function isCancelacionTardia(fechaInicio) {
  if (!fechaInicio) return false;
  const start = new Date(`${fechaInicio}T12:00:00`);
  const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntil < 24;
}

async function liberarFechasReserva(bookingId) {
  try {
    const res = await fetch("/api/bookings/liberar-fechas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(
        "No se pudo liberar disponibilidad:",
        data.error || res.status,
        { bookingId },
      );
    }
  } catch (e) {
    console.error("No se pudo liberar disponibilidad:", e, { bookingId });
  }
}

export async function procesarCancelacionTardia({
  bookingId,
  supabaseClient,
  userEmail,
  clienteNombre,
}) {
  const { data: booking, error } = await supabaseClient
    .from("bookings")
    .select(
      `
      *,
      services:service_id (
        id,
        titulo,
        vertical,
        ciudad,
        proveedor_id
      )
    `,
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return { ok: false, error: "Reserva no encontrada" };
  }

  if (!isCancelacionTardia(booking.fecha_inicio)) {
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update({ estado: "cancelada" })
      .eq("id", bookingId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    await liberarFechasReserva(bookingId);
    return { ok: true, garantia: false };
  }

  const service = booking.services;
  const garantiaRes = await fetch("/api/garantia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: service?.id || booking.service_id,
      fecha_inicio: booking.fecha_inicio,
      fecha_fin: booking.fecha_fin || booking.fecha_inicio,
      vertical: service?.vertical,
      ciudad: service?.ciudad,
    }),
  });

  const garantiaData = await garantiaRes.json();
  const alternativas = garantiaData.alternativas ?? [];

  const { error: updateError } = await supabaseClient
    .from("bookings")
    .update({
      estado: "cancelada_garantia",
      estado_garantia: "activada",
      cancelado_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await liberarFechasReserva(bookingId);

  if (alternativas.length > 0 && userEmail) {
    await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "cancelacion_garantia",
        cliente_email: userEmail,
        cliente_nombre: clienteNombre || "Cliente",
        precio_original: booking.precio_total,
        alternativas,
      }),
    });
  }

  return { ok: true, garantia: true, alternativas };
}
