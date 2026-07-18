import { supabase } from "@/app/lib/supabase";
import { isAdminUserId } from "@/lib/auth/admin";
import { attachModalidadesToService } from "@/app/lib/service-modalidades-server";
import {
  SERVICE_PUBLIC_SELECT,
  stripPrivateServiceFields,
} from "@/app/lib/location-privacy";

/**
 * Servicio visible en búsqueda / anuncio público.
 * Mismos filtros que /buscar: solo aprobado (o legacy null).
 * Sin dirección exacta, teléfono ni coordenadas precisas.
 */
export async function loadPublicServiceById(serviceId) {
  if (!serviceId) return null;

  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_PUBLIC_SELECT)
    .eq("id", serviceId)
    .eq("disponible", true)
    .eq("profiles_public.verificado", true)
    .or("revision_estado.is.null,revision_estado.eq.aprobado")
    .maybeSingle();

  if (error || !data) return null;
  return attachModalidadesToService(stripPrivateServiceFields(data));
}

const OWNER_PROFILE_SELECT =
  "id, nombre, apellido, foto_perfil, descripcion, ciudad, location_zone, verificado, idiomas, badge_respuesta";

/**
 * Servicio del proveedor autenticado para vista previa (sin filtros públicos).
 * Solo devuelve datos si proveedor_id === userId (comprobado en la query).
 * Incluye dirección/teléfono (dueño).
 */
export async function loadOwnerServiceForPreview(serviceId, userId, supabaseClient) {
  if (!serviceId || !userId || !supabaseClient) return null;

  const { data: service, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("proveedor_id", userId)
    .maybeSingle();

  if (error || !service) return null;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select(OWNER_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  return attachModalidadesToService({
    ...service,
    profiles_public: profile ?? {},
  });
}

/**
 * Vista previa admin de cualquier servicio (moderación).
 * Incluye campos privados (moderación).
 */
export async function loadAdminServiceForPreview(serviceId, supabaseClient) {
  if (!serviceId || !supabaseClient) return null;

  const { data: service, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !service) return null;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select(OWNER_PROFILE_SELECT)
    .eq("id", service.proveedor_id)
    .maybeSingle();

  return attachModalidadesToService({
    ...service,
    profiles_public: profile ?? {},
  });
}

/**
 * Carga anuncio público o, con preview autorizado, borrador del dueño / admin.
 *
 * @returns {{ service: object|null, mode: 'public'|'owner-preview'|'admin-preview'|null }}
 */
export async function loadAnuncioService(
  serviceId,
  {
    previewRequested = false,
    userId = null,
    supabase: supabaseClient = null,
  } = {},
) {
  // Dueño/admin con preview: cargar completo (con dirección) aunque el anuncio
  // también sea público, para que el proveedor vea sus datos privados.
  if (previewRequested && userId && supabaseClient) {
    if (isAdminUserId(userId)) {
      const adminService = await loadAdminServiceForPreview(
        serviceId,
        supabaseClient,
      );
      if (adminService) {
        return { service: adminService, mode: "admin-preview" };
      }
    }

    const ownerService = await loadOwnerServiceForPreview(
      serviceId,
      userId,
      supabaseClient,
    );
    if (ownerService) {
      return { service: ownerService, mode: "owner-preview" };
    }
  }

  const publicService = await loadPublicServiceById(serviceId);
  if (publicService) {
    return { service: publicService, mode: "public" };
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
