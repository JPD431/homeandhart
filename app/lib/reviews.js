import { getPublicSupabase } from "@/app/lib/supabase-public";

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

/**
 * Media ponderada 1× por cliente:
 * 1) media de valoraciones de cada cliente
 * 2) media del proveedor = media de esas medias
 *
 * count = total de reseñas (para mostrar "N reseñas")
 * clientCount = clientes distintos que reseñaron
 * avg = media ponderada
 * sum = suma de medias por cliente (compat: sum/clientCount ≈ avg)
 */
export function computeProveedorRating(reviews) {
  const list = reviews ?? [];
  if (list.length === 0) {
    return { sum: 0, count: 0, clientCount: 0, avg: null };
  }

  const byCliente = new Map();
  for (const rev of list) {
    const cid =
      rev?.cliente_id != null && rev.cliente_id !== ""
        ? String(rev.cliente_id)
        : `__anon_${byCliente.size}`;
    const val = Number(rev.valoracion);
    if (!Number.isFinite(val)) continue;
    if (!byCliente.has(cid)) byCliente.set(cid, []);
    byCliente.get(cid).push(val);
  }

  if (byCliente.size === 0) {
    return { sum: 0, count: 0, clientCount: 0, avg: null };
  }

  let sumClientAvgs = 0;
  for (const vals of byCliente.values()) {
    const clientAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    sumClientAvgs += clientAvg;
  }

  const clientCount = byCliente.size;
  const count = list.length;
  const avg = sumClientAvgs / clientCount;

  return {
    sum: sumClientAvgs,
    count,
    clientCount,
    avg,
  };
}

/** Media formateada (1 decimal) o null si no hay reseñas. */
export function formatProveedorRatingAvg(rating) {
  if (!rating?.count || rating.avg == null) return null;
  return Number(rating.avg).toFixed(1);
}

/**
 * Agrupa reviews por proveedor_id y calcula rating ponderado por cliente.
 * @returns {Record<string, ReturnType<typeof computeProveedorRating>>}
 */
export function aggregateRatingsByProveedor(reviews) {
  const byProv = {};
  for (const rev of reviews ?? []) {
    const pid = rev?.proveedor_id;
    if (!pid) continue;
    if (!byProv[pid]) byProv[pid] = [];
    byProv[pid].push(rev);
  }
  const map = {};
  for (const [pid, list] of Object.entries(byProv)) {
    map[pid] = computeProveedorRating(list);
  }
  return map;
}

/** Valoración media + count de un proveedor (reviews por proveedor_id). */
export async function loadProveedorRating(proveedorId) {
  if (!proveedorId) {
    return { sum: 0, count: 0, clientCount: 0, avg: null };
  }

  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("reviews")
    .select("valoracion, cliente_id")
    .eq("proveedor_id", proveedorId)
    .limit(1000);

  return computeProveedorRating(data);
}
