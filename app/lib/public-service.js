import { supabase } from "@/app/lib/supabase";

const SERVICE_PUBLIC_SELECT = `
  *,
  profiles_public!inner (
    id,
    nombre,
    apellido,
    foto_perfil,
    foto_url,
    descripcion,
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

const OWNER_PROFILE_SELECT =
  "id, nombre, apellido, foto_perfil, descripcion, ciudad, location_zone, verificado, idiomas, badge_respuesta";

/**
 * Servicio del proveedor autenticado para vista previa (sin filtros públicos).
 * Solo devuelve datos si proveedor_id === userId (comprobado en la query).
 */
export async function loadOwnerServiceForPreview(serviceId, userId, supabase) {
  if (!serviceId || !userId || !supabase) return null;

  const { data: service, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("proveedor_id", userId)
    .maybeSingle();

  if (error || !service) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(OWNER_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  return {
    ...service,
    profiles_public: profile ?? {},
  };
}

/**
 * Carga anuncio público o, con preview autorizado, el borrador del dueño.
 *
 * @returns {{ service: object|null, mode: 'public'|'owner-preview'|null }}
 */
export async function loadAnuncioService(
  serviceId,
  { previewRequested = false, userId = null, supabase = null } = {},
) {
  const publicService = await loadPublicServiceById(serviceId);
  if (publicService) {
    return { service: publicService, mode: "public" };
  }

  if (previewRequested && userId && supabase) {
    const ownerService = await loadOwnerServiceForPreview(
      serviceId,
      userId,
      supabase,
    );
    if (ownerService) {
      return { service: ownerService, mode: "owner-preview" };
    }
  }

  return { service: null, mode: null };
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

const DIAS_SEMANA_DEFAULT = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];

/** Entrada mínima para CalendarioDisponibilidad (un solo servicio). */
export function buildCalendarioServiceEntry(service, { titulo, label }) {
  const dias =
    Array.isArray(service?.dias_disponibles) &&
    service.dias_disponibles.length > 0
      ? service.dias_disponibles
      : DIAS_SEMANA_DEFAULT;

  return {
    id: service.id,
    titulo: titulo || label || "Servicio",
    label: label || "Servicio",
    dias_disponibles: dias,
  };
}
