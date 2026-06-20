/**
 * Carga tarifas por fecha de un servicio en un rango (inclusive).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} serviceId
 * @param {string} fechaInicio YYYY-MM-DD
 * @param {string} [fechaFin] YYYY-MM-DD
 * @returns {Promise<Record<string, number>>} map { "YYYY-MM-DD": precio }
 */
export async function cargarTarifasPorFecha(
  supabaseClient,
  serviceId,
  fechaInicio,
  fechaFin,
) {
  if (!supabaseClient || !serviceId || !fechaInicio) {
    return {};
  }

  const fin = fechaFin || fechaInicio;

  const { data, error } = await supabaseClient
    .from("service_tarifas")
    .select("fecha, precio")
    .eq("service_id", serviceId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fin);

  if (error) {
    throw error;
  }

  const map = {};
  for (const row of data ?? []) {
    const fecha =
      typeof row.fecha === "string" ? row.fecha.slice(0, 10) : row.fecha;
    if (fecha) {
      map[fecha] = Number(row.precio);
    }
  }
  return map;
}

/**
 * Tarifas por service_id (una query para bundles).
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export async function cargarTarifasPorServicios(
  supabaseClient,
  serviceIds,
  fechaInicio,
  fechaFin,
) {
  const ids = [...new Set((serviceIds ?? []).filter(Boolean))];
  const result = Object.fromEntries(ids.map((id) => [id, {}]));

  if (!supabaseClient || ids.length === 0 || !fechaInicio) {
    return result;
  }

  const fin = fechaFin || fechaInicio;

  const { data, error } = await supabaseClient
    .from("service_tarifas")
    .select("service_id, fecha, precio")
    .in("service_id", ids)
    .gte("fecha", fechaInicio)
    .lte("fecha", fin);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const serviceId = row.service_id;
    const fecha =
      typeof row.fecha === "string" ? row.fecha.slice(0, 10) : row.fecha;
    if (!serviceId || !fecha) continue;
    if (!result[serviceId]) result[serviceId] = {};
    result[serviceId][fecha] = Number(row.precio);
  }

  return result;
}
