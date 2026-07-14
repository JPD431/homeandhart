/** Notificaciones in-app (insert con service role; lectura vía RLS del usuario). */

const DUPLICATE_ERROR_CODES = new Set(["23505"]);

function formatFechasReserva(fechaInicio, fechaFin) {
  const fmt = (s) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return s;
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  };

  if (!fechaInicio) return "";
  const inicio = fmt(fechaInicio);
  const fin =
    fechaFin && fechaFin !== fechaInicio ? fmt(fechaFin) : null;
  return fin ? `${inicio} — ${fin}` : inicio;
}

/**
 * Inserta una notificación de forma idempotente (unique user_id+tipo+entity_id).
 * Nunca lanza: errores se registran y devuelve { ok: false }.
 */
export async function createNotification(admin, {
  user_id,
  tipo,
  titulo,
  mensaje,
  href,
  entity_type,
  entity_id,
}) {
  if (!admin || !user_id || !tipo || !titulo) {
    return { ok: false, reason: "missing_fields" };
  }

  const { error } = await admin.from("notifications").insert({
    user_id,
    tipo,
    titulo,
    mensaje: mensaje ?? null,
    href: href ?? null,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    leida: false,
  });

  if (error) {
    if (DUPLICATE_ERROR_CODES.has(error.code)) {
      return { ok: true, duplicate: true };
    }
    console.error("[notifications] Error insertando:", error.message, {
      tipo,
      user_id,
      entity_id,
    });
    return { ok: false, error };
  }

  return { ok: true };
}

/** Crea notificación para eventos de reserva (MVP). */
export async function notifyBookingEvent(admin, {
  tipo,
  bookingId,
  proveedorId,
  clienteId,
  clienteNombre,
  proveedorNombre,
  servicioTitulo,
  fechaInicio,
  fechaFin,
}) {
  if (!admin || !bookingId || !tipo) return { ok: false };

  const fechas = formatFechasReserva(fechaInicio, fechaFin);
  const servicio = servicioTitulo?.trim() || "Servicio";
  const hrefReserva = `/reserva/${bookingId}`;
  const fechasSuffix = fechas ? ` · ${fechas}` : "";

  switch (tipo) {
    case "reserva_nueva":
      if (!proveedorId) return { ok: false, reason: "no_proveedor" };
      return createNotification(admin, {
        user_id: proveedorId,
        tipo: "reserva_nueva",
        titulo: "Nueva reserva",
        mensaje: `${clienteNombre || "Un cliente"} ha solicitado ${servicio}${fechasSuffix}.`,
        href: hrefReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_confirmada":
      if (!clienteId) return { ok: false, reason: "no_cliente" };
      return createNotification(admin, {
        user_id: clienteId,
        tipo: "reserva_confirmada",
        titulo: "Reserva confirmada",
        mensaje: `${proveedorNombre || "El proveedor"} ha confirmado tu reserva de ${servicio}${fechasSuffix}.`,
        href: hrefReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_rechazada":
      if (!clienteId) return { ok: false, reason: "no_cliente" };
      return createNotification(admin, {
        user_id: clienteId,
        tipo: "reserva_rechazada",
        titulo: "Reserva rechazada",
        mensaje: `${proveedorNombre || "El proveedor"} no ha podido aceptar tu solicitud de ${servicio}${fechasSuffix}. Puedes buscar otras opciones.`,
        href: hrefReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    default:
      console.warn("[notifications] tipo de reserva desconocido:", tipo);
      return { ok: false, reason: "unknown_tipo" };
  }
}
