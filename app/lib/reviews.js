import { supabase } from "@/app/lib/supabase";

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
