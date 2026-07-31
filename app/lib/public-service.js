import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminUserId } from "@/lib/auth/admin";
import { attachModalidadesToService } from "@/app/lib/service-modalidades-server";
import {
  SERVICE_PUBLIC_SELECT,
  stripPrivateServiceFields,
} from "@/app/lib/location-privacy";
import {
  loadServiceContact,
  loadServiceContactAdmin,
  mergeResolvedContactIntoService,
} from "@/app/lib/service-contact";
import { getPublicSupabase } from "@/app/lib/supabase-public";

function getSupabaseAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Servicio visible en búsqueda / anuncio público.
 * Mismos filtros que /buscar: solo aprobado (o legacy null).
 * Sin dirección exacta, teléfono ni coordenadas precisas.
 */
export async function loadPublicServiceById(serviceId) {
  if (!serviceId) return null;

  const supabase = getPublicSupabase();
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
 * Incluye dirección/teléfono (dueño). Usa el cliente del usuario (RLS dueño).
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

  const contact = await loadServiceContact(service.id, supabaseClient);
  const withContact = mergeResolvedContactIntoService(service, contact);

  return attachModalidadesToService({
    ...withContact,
    profiles_public: profile ?? {},
  });
}

/**
 * Vista previa admin de cualquier servicio (moderación), vía SERVICE ROLE.
 * NO usa el cliente del navegador (RLS no aplica): así funciona tras Paso B
 * aunque el servicio esté en borrador/en_revision.
 *
 * SOLO llamar tras verificar isAdminUserId(userId) / getAdminUser().
 */
export async function loadAdminServiceForPreview(serviceId) {
  if (!serviceId) return null;

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error(
      "[public-service] loadAdminServiceForPreview: falta SERVICE_ROLE",
    );
    return null;
  }

  const { data: service, error } = await admin
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !service) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select(OWNER_PROFILE_SELECT)
    .eq("id", service.proveedor_id)
    .maybeSingle();

  const contact = await loadServiceContactAdmin(service.id);
  const withContact = mergeResolvedContactIntoService(service, contact);

  return attachModalidadesToService({
    ...withContact,
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
  // Preview: admin (service role) o dueño (RLS propio).
  if (previewRequested && userId) {
    if (isAdminUserId(userId)) {
      const adminService = await loadAdminServiceForPreview(serviceId);
      if (adminService) {
        return { service: adminService, mode: "admin-preview" };
      }
    }

    if (supabaseClient) {
      const ownerService = await loadOwnerServiceForPreview(
        serviceId,
        userId,
        supabaseClient,
      );
      if (ownerService) {
        return { service: ownerService, mode: "owner-preview" };
      }
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

  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("disponibilidad")
    .select("fecha_inicio, fecha_fin, service_id")
    .eq("service_id", serviceId)
    .limit(500);

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
