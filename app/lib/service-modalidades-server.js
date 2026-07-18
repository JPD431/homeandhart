import { createClient } from "@supabase/supabase-js";
import { supportsModalidadCobro } from "@/app/lib/modalidad-cobro";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Carga filas de service_modalidades (server). Sin filas = [].
 */
export async function loadServiceModalidadesRows(serviceId) {
  if (!serviceId) return [];
  const { data, error } = await supabaseAdmin
    .from("service_modalidades")
    .select("modalidad, precio, horas_unidad, suplemento_extra")
    .eq("service_id", serviceId)
    .order("modalidad", { ascending: true });

  if (error) {
    console.error("[modalidades] load error", error.message);
    return [];
  }
  return data ?? [];
}

/** Adjunta service.modalidades si aplica. */
export async function attachModalidadesToService(service) {
  if (!service?.id || !supportsModalidadCobro(service.vertical)) {
    return service;
  }
  const modalidades = await loadServiceModalidadesRows(service.id);
  return { ...service, modalidades };
}
