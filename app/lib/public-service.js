import { supabase } from "@/app/lib/supabase";

const SERVICE_PUBLIC_SELECT = `
  *,
  profiles_public!inner (
    id,
    nombre,
    apellido,
    foto_perfil,
    ciudad,
    location_zone,
    verificado,
    idiomas,
    badge_respuesta
  )
`;

/**
 * Servicio visible en búsqueda / anuncio público.
 * Mismos filtros que /buscar.
 */
export async function loadPublicServiceById(serviceId) {
  if (!serviceId) return null;

  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_PUBLIC_SELECT)
    .eq("id", serviceId)
    .eq("disponible", true)
    .eq("profiles_public.verificado", true)
    .or("revision_estado.is.null,revision_estado.neq.borrador")
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** Bloqueos de disponibilidad de un servicio (calendario Fase B). */
export async function loadServiceBloqueos(serviceId) {
  if (!serviceId) return [];

  const { data } = await supabase
    .from("disponibilidad")
    .select("fecha_inicio, fecha_fin, service_id")
    .eq("service_id", serviceId);

  return data ?? [];
}
