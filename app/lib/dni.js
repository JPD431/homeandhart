/**
 * DNI obligatorio para todos los usuarios (clientes y proveedores).
 * Texto legal centralizado — reemplazar antes de producción.
 */

// TODO LEGAL: reemplazar con texto del abogado antes de producción
export const TEXTO_CONSENTIMIENTO_DNI =
  "Autorizo a Home&Heart a almacenar mi documento de identidad para fines de verificación y seguridad, conforme a la política de privacidad.";

export const DNI_REQUIRED_ERROR_CODE = "dni_required";

export const DNI_SUBIR_RUTA = "/subir-dni";

export const DNI_REQUIRED_CLIENT_MSG =
  "Para reservar necesitas subir tu DNI, NIE o pasaporte.";

export const DNI_REQUIRED_PROVIDER_MSG =
  "Para publicar o activar servicios necesitas subir tu DNI, NIE o pasaporte.";

export const DNI_BANNER_CLIENT_MSG =
  "Sube tu DNI para poder reservar servicios.";

export const DNI_BANNER_PROVIDER_MSG =
  "Sube tu DNI para poder publicar servicios.";

/**
 * @param {{ doc_dni_url?: string | null } | null | undefined} profile
 * @returns {boolean}
 */
export function hasDniUploaded(profile) {
  const raw = profile?.doc_dni_url;
  if (raw == null) return false;
  return String(raw).trim().length > 0;
}

/**
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export function sanitizeInternalRedirect(path) {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/subir-dni")) return null;
  return trimmed;
}

/**
 * Comprueba DNI en servidor (API routes).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ clientMessage?: string }} [options]
 */
export async function assertUserHasDni(supabaseAdmin, userId, options = {}) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("doc_dni_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error.message },
    };
  }

  if (!hasDniUploaded(data)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: options.clientMessage || DNI_REQUIRED_CLIENT_MSG,
        code: DNI_REQUIRED_ERROR_CODE,
        redirect: DNI_SUBIR_RUTA,
      },
    };
  }

  return { ok: true };
}
