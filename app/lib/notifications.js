/** Notificaciones in-app (insert con service role; lectura vía RLS del usuario). */

import { createClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[notifications]";
const DUPLICATE_ERROR_CODES = new Set(["23505"]);

/** Cliente admin dedicado para INSERT (bypass RLS). No reutilizar el cliente de sesión. */
let notificationsAdmin = null;

function getNotificationsAdmin() {
  if (notificationsAdmin) return notificationsAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      LOG_PREFIX,
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
    return null;
  }

  notificationsAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return notificationsAdmin;
}

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

function logInsertError(error, payload) {
  console.error(LOG_PREFIX, "Error insertando notificación:", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    payload,
  });
}

/**
 * Inserta una notificación de forma idempotente (unique user_id+tipo+entity_id).
 * Usa SIEMPRE service role interno. No lanza excepciones.
 */
export async function createNotification(_adminUnused, {
  user_id,
  tipo,
  titulo,
  mensaje,
  href,
  entity_type,
  entity_id,
}) {
  const payload = {
    user_id,
    tipo,
    titulo,
    mensaje: mensaje ?? null,
    href: href ?? null,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    leida: false,
  };

  if (!user_id || !tipo || !titulo) {
    console.error(LOG_PREFIX, "Campos obligatorios faltantes:", {
      user_id: user_id ?? null,
      tipo: tipo ?? null,
      titulo: titulo ?? null,
      entity_id: entity_id ?? null,
    });
    return { ok: false, reason: "missing_fields" };
  }

  const admin = getNotificationsAdmin();
  if (!admin) {
    return { ok: false, reason: "no_admin_client" };
  }

  console.log(LOG_PREFIX, "Intentando insert:", {
    user_id,
    tipo,
    entity_type,
    entity_id,
    titulo,
  });

  const { data, error } = await admin
    .from("notifications")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    if (DUPLICATE_ERROR_CODES.has(error.code)) {
      console.log(LOG_PREFIX, "Insert duplicado (idempotente OK):", {
        user_id,
        tipo,
        entity_id,
      });
      return { ok: true, duplicate: true };
    }

    logInsertError(error, payload);
    return { ok: false, reason: "insert_error", error };
  }

  if (!data?.id) {
    console.error(
      LOG_PREFIX,
      "Insert sin error pero sin fila devuelta:",
      payload,
    );
    return { ok: false, reason: "no_row_returned" };
  }

  console.log(LOG_PREFIX, "Notificación creada:", {
    id: data.id,
    user_id,
    tipo,
    entity_id,
  });

  return { ok: true, id: data.id };
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
  if (!bookingId || !tipo) {
    console.error(LOG_PREFIX, "notifyBookingEvent: faltan bookingId o tipo", {
      bookingId,
      tipo,
    });
    return { ok: false, reason: "missing_booking_or_tipo" };
  }

  const fechas = formatFechasReserva(fechaInicio, fechaFin);
  const servicio = servicioTitulo?.trim() || "Servicio";
  const hrefClienteReserva = `/reserva/${bookingId}`;
  const hrefProveedorReserva = `/dashboard?tab=proveedor&booking=${bookingId}`;
  const fechasSuffix = fechas ? ` · ${fechas}` : "";

  switch (tipo) {
    case "reserva_nueva":
      if (!proveedorId) {
        console.error(LOG_PREFIX, "reserva_nueva sin proveedorId", { bookingId });
        return { ok: false, reason: "no_proveedor" };
      }
      return createNotification(admin, {
        user_id: proveedorId,
        tipo: "reserva_nueva",
        titulo: "Nueva reserva",
        mensaje: `${clienteNombre || "Un cliente"} ha solicitado ${servicio}${fechasSuffix}.`,
        href: hrefProveedorReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_confirmada":
      if (!clienteId) {
        console.error(LOG_PREFIX, "reserva_confirmada sin clienteId", {
          bookingId,
        });
        return { ok: false, reason: "no_cliente" };
      }
      return createNotification(admin, {
        user_id: clienteId,
        tipo: "reserva_confirmada",
        titulo: "Reserva confirmada",
        mensaje: `${proveedorNombre || "El proveedor"} ha confirmado tu reserva de ${servicio}${fechasSuffix}.`,
        href: hrefClienteReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_rechazada":
      if (!clienteId) {
        console.error(LOG_PREFIX, "reserva_rechazada sin clienteId", {
          bookingId,
        });
        return { ok: false, reason: "no_cliente" };
      }
      return createNotification(admin, {
        user_id: clienteId,
        tipo: "reserva_rechazada",
        titulo: "Reserva rechazada",
        mensaje: `${proveedorNombre || "El proveedor"} no ha podido aceptar tu solicitud de ${servicio}${fechasSuffix}. Puedes buscar otras opciones.`,
        href: hrefClienteReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_cancelada_cliente":
      if (!proveedorId) {
        console.error(LOG_PREFIX, "reserva_cancelada_cliente sin proveedorId", {
          bookingId,
        });
        return { ok: false, reason: "no_proveedor" };
      }
      return createNotification(admin, {
        user_id: proveedorId,
        tipo: "reserva_cancelada_cliente",
        titulo: "Reserva cancelada",
        mensaje: `${clienteNombre || "Un cliente"} ha cancelado la reserva de ${servicio}${fechasSuffix}.`,
        href: hrefProveedorReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    case "reserva_cancelada_proveedor":
      if (!clienteId) {
        console.error(LOG_PREFIX, "reserva_cancelada_proveedor sin clienteId", {
          bookingId,
        });
        return { ok: false, reason: "no_cliente" };
      }
      return createNotification(admin, {
        user_id: clienteId,
        tipo: "reserva_cancelada_proveedor",
        titulo: "Reserva cancelada",
        mensaje: `${proveedorNombre || "El proveedor"} ha cancelado tu reserva de ${servicio}${fechasSuffix}. Hemos activado la Garantía Home&Heart para ayudarte.`,
        href: hrefClienteReserva,
        entity_type: "booking",
        entity_id: bookingId,
      });

    default:
      console.warn(LOG_PREFIX, "tipo de reserva desconocido:", tipo);
      return { ok: false, reason: "unknown_tipo" };
  }
}

/** Destino al pulsar una notificación (corrige href legacy en cliente). */
export function resolveNotificationHref(notification) {
  const { tipo, entity_id: entityId, href } = notification ?? {};

  if (tipo === "reserva_nueva" && entityId) {
    return `/dashboard?tab=proveedor&booking=${entityId}`;
  }

  if (tipo === "reserva_cancelada_cliente" && entityId) {
    return `/dashboard?tab=proveedor&booking=${entityId}`;
  }

  if (
    (tipo === "reserva_confirmada" ||
      tipo === "reserva_rechazada" ||
      tipo === "reserva_cancelada_proveedor") &&
    entityId
  ) {
    return `/reserva/${entityId}`;
  }

  if (tipo === "deja_resena" && entityId) {
    return `/resena/${entityId}`;
  }

  return href || "/dashboard";
}
