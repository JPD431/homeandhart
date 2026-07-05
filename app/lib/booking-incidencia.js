/** Estados en los que cliente o proveedor pueden reportar una incidencia. */
export const ESTADOS_REPORTABLES_INCIDENCIA = new Set([
  "confirmada",
  "en_curso",
  "completada",
]);

export const MOTIVOS_INCIDENCIA_RESERVA = [
  "Servicio no cumplió lo acordado",
  "No se presentó al servicio",
  "Comportamiento inapropiado",
  "Problema con el alojamiento o instalaciones",
  "Problema con el pago o cobro",
  "Otro",
];

export function puedeReportarIncidencia(estado) {
  const key = estado === "cancelada_garantia" ? "cancelada" : estado;
  return ESTADOS_REPORTABLES_INCIDENCIA.has(key);
}

/**
 * Registra incidencia en `reports` y marca la reserva como `incidencia`.
 * Coherente con el panel admin (pestaña Reportes) y retención de pago vía cron.
 */
export async function registrarIncidenciaReserva(supabaseAdmin, {
  booking,
  service,
  reporterId,
  reporterRol,
  motivo,
  comentario,
}) {
  if (!booking?.id || !service?.proveedor_id || !booking.cliente_id) {
    return { error: "Datos de reserva incompletos", status: 500 };
  }

  if (booking.estado === "incidencia") {
    return {
      error: "Esta reserva ya tiene una incidencia en curso.",
      status: 409,
    };
  }

  if (!puedeReportarIncidencia(booking.estado)) {
    return {
      error: "Solo se puede reportar una incidencia en reservas confirmadas, en curso o completadas.",
      status: 400,
    };
  }

  const { data: pendingReport } = await supabaseAdmin
    .from("reports")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (pendingReport) {
    return {
      error: "Ya hay un reporte pendiente para esta reserva.",
      status: 409,
    };
  }

  const reportedId =
    reporterRol === "cliente" ? service.proveedor_id : booking.cliente_id;
  const motivoFinal = motivo?.trim() || "Incidencia en reserva";
  const descripcion = comentario?.trim() || "";

  const { error: reportError } = await supabaseAdmin.from("reports").insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    booking_id: booking.id,
    tipo: "servicio",
    motivo: motivoFinal,
    descripcion: descripcion
      ? `Reportado por ${reporterRol}: ${descripcion}`
      : `Reportado por ${reporterRol}`,
    estado: "pendiente",
  });

  if (reportError) {
    return { error: reportError.message, status: 500 };
  }

  const bookingUpdate = { estado: "incidencia" };
  if (reporterRol === "cliente") {
    bookingUpdate.confirmacion_cliente = "problema";
    bookingUpdate.comentario_problema = descripcion || null;
    bookingUpdate.confirmado_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", booking.id);

  if (updateError) {
    return { error: updateError.message, status: 500 };
  }

  return {
    success: true,
    reporterRol,
    motivoFinal,
    descripcion,
  };
}

export async function enviarEmailIncidenciaReserva(baseUrl, payload) {
  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "incidencia_reserva", ...payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[incidencia_reserva] Email falló:", data.error || res.status);
    }
  } catch (err) {
    console.error("[incidencia_reserva] Email error:", err);
  }
}
