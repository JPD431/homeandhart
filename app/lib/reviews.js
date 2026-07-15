import { supabase } from "@/app/lib/supabase";

/** Plazo para dejar reseña tras completar el servicio (independiente del token de pago 24h). */
export const REVIEW_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fecha a partir de la cual cuenta el plazo de reseña.
 * Prefiere completada_at; si falta, fin del servicio (fecha_fin o fecha_inicio).
 */
export function getBookingCompletedAt(booking) {
  if (booking?.completada_at) {
    const d = new Date(booking.completada_at);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const dateStr = booking?.fecha_fin || booking?.fecha_inicio;
  if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) {
    const day = String(dateStr).slice(0, 10);
    const d = new Date(`${day}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

export function getReviewDeadline(booking) {
  const completedAt = getBookingCompletedAt(booking);
  if (!completedAt) return null;
  return new Date(completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY_MS);
}

export function isWithinReviewWindow(booking, now = new Date()) {
  const deadline = getReviewDeadline(booking);
  if (!deadline) return false;
  return now.getTime() <= deadline.getTime();
}

/**
 * ¿Puede el cliente dejar reseña?
 * Independiente de confirmacion_cliente / token de pago.
 */
export function canLeaveReview(booking, { hasReview = false, userId = null } = {}) {
  if (!booking) return { ok: false, reason: "not_found" };
  if (userId && booking.cliente_id !== userId) {
    return { ok: false, reason: "forbidden" };
  }
  if (booking.estado !== "completada") {
    return { ok: false, reason: "not_completed" };
  }
  if (hasReview) return { ok: false, reason: "already_reviewed" };
  if (!isWithinReviewWindow(booking)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function reviewEligibilityMessage(reason) {
  switch (reason) {
    case "forbidden":
      return "No tienes permiso para valorar esta reserva.";
    case "not_completed":
      return "Solo puedes valorar reservas completadas.";
    case "already_reviewed":
      return "Ya has valorado este servicio.";
    case "expired":
      return "El plazo de 14 días para dejar reseña ha terminado. Gracias por usar Home&Heart.";
    case "not_found":
      return "No se encontró la reserva.";
    default:
      return "No se puede dejar reseña ahora.";
  }
}

/** Agrega valoraciones de reviews en { sum, count, avg }. */
export function computeProveedorRating(reviews) {
  const list = reviews ?? [];
  if (list.length === 0) {
    return { sum: 0, count: 0, avg: null };
  }

  let sum = 0;
  for (const rev of list) {
    sum += Number(rev.valoracion) || 0;
  }
  const count = list.length;
  return {
    sum,
    count,
    avg: count > 0 ? sum / count : null,
  };
}

/** Media formateada (1 decimal) o null si no hay reseñas. */
export function formatProveedorRatingAvg(rating) {
  if (!rating?.count || rating.avg == null) return null;
  return rating.avg.toFixed(1);
}

/** Valoración media + count de un proveedor (reviews por proveedor_id). */
export async function loadProveedorRating(proveedorId) {
  if (!proveedorId) {
    return { sum: 0, count: 0, avg: null };
  }

  const { data } = await supabase
    .from("reviews")
    .select("valoracion")
    .eq("proveedor_id", proveedorId);

  return computeProveedorRating(data);
}
