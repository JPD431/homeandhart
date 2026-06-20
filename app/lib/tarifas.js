import { toDateStr } from "@/app/components/calendario-shared";

function addDaysToDateStr(dateStr, offsetDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return toDateStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Expande rangos de disponibilidad (reservas) a fechas YYYY-MM-DD dentro de [desde, hasta].
 * Misma semántica que el calendario de reserva: día incluido si fecha_inicio <= día <= fecha_fin.
 */
export function expandDisponibilidadAFechas(rangos, desde, hasta) {
  const ocupadas = new Set();

  for (const row of rangos ?? []) {
    const start =
      typeof row.fecha_inicio === "string"
        ? row.fecha_inicio.slice(0, 10)
        : row.fecha_inicio;
    const endRaw =
      typeof row.fecha_fin === "string"
        ? row.fecha_fin.slice(0, 10)
        : row.fecha_fin;
    const end = endRaw || start;
    if (!start) continue;

    let cur = start;
    while (cur <= end) {
      if (cur >= desde && cur <= hasta) ocupadas.add(cur);
      cur = addDaysToDateStr(cur, 1);
    }
  }

  return [...ocupadas].sort();
}

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
