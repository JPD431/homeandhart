/**
 * DNI obligatorio para todos los usuarios (clientes y proveedores).
 * Texto legal centralizado — reemplazar antes de producción.
 *
 * Nota: profiles.verificado = aprobación de cuenta proveedor (concepto distinto).
 * dni_estado = revisión manual del documento de identidad.
 */

import { isValidInternalRedirect } from "@/app/lib/auth-redirect";

// TODO LEGAL: reemplazar con texto del abogado antes de producción
export const TEXTO_CONSENTIMIENTO_DNI =
  "Autorizo a Home&Heart a almacenar mi documento de identidad para fines de verificación y seguridad, conforme a la política de privacidad.";

export const DNI_REQUIRED_ERROR_CODE = "dni_required";
export const DNI_NOT_VERIFIED_ERROR_CODE = "dni_not_verified";

export const DNI_SUBIR_RUTA = "/subir-dni";

/** @deprecated Preferir mensajes por caso (sin DNI / pendiente / rechazado). */
export const DNI_REQUIRED_CLIENT_MSG =
  "Verifica tu identidad para reservar.";

export const DNI_REQUIRED_PROVIDER_MSG =
  "Para publicar o activar servicios necesitas subir tu DNI, NIE o pasaporte.";

export const DNI_BANNER_CLIENT_MSG =
  "Sube tu DNI para poder reservar servicios.";

export const DNI_BANNER_PROVIDER_MSG =
  "Sube tu DNI para poder publicar servicios.";

export const DNI_BANNER_PENDING_MSG = "Tu identidad está en revisión.";

export const DNI_VERIFY_REQUIRED_MSG =
  "Verifica tu identidad para reservar.";

export const DNI_PENDING_REVIEW_MSG =
  "Tu identidad está en revisión. Podrás reservar cuando la verifiquemos (suele ser rápido).";

export const DNI_REJECTED_MSG =
  "Tu documento fue rechazado, vuelve a subirlo.";

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
 * Cliente (o usuario) con DNI aprobado por admin.
 * Independiente de profiles.verificado (aprobación de proveedor).
 * @param {{ dni_estado?: string | null } | null | undefined} profile
 * @returns {boolean}
 */
export function isClienteVerificado(profile) {
  return profile?.dni_estado === "verificado";
}

/**
 * @param {{ doc_dni_url?: string | null, dni_estado?: string | null } | null | undefined} profile
 * @returns {'sin_dni' | 'pendiente' | 'verificado' | 'rechazado'}
 */
export function getDniRevisionEstado(profile) {
  if (!hasDniUploaded(profile)) return "sin_dni";
  const estado = profile?.dni_estado;
  if (estado === "verificado") return "verificado";
  if (estado === "rechazado") return "rechazado";
  return "pendiente";
}

/**
 * Mensaje de bloqueo de reserva según estado de verificación.
 * @param {{ doc_dni_url?: string | null, dni_estado?: string | null } | null | undefined} profile
 * @returns {string | null} null si puede reservar
 */
export function getClienteReservaDniBlockMessage(profile) {
  if (isClienteVerificado(profile)) return null;
  const estado = getDniRevisionEstado(profile);
  if (estado === "pendiente") return DNI_PENDING_REVIEW_MSG;
  if (estado === "rechazado") return DNI_REJECTED_MSG;
  return DNI_VERIFY_REQUIRED_MSG;
}

/**
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export function sanitizeInternalRedirect(path) {
  const base = isValidInternalRedirect(path);
  if (!base || base.startsWith("/subir-dni")) return null;
  return base;
}

/**
 * Comprueba que el usuario tiene DNI subido (sin exigir aprobación admin).
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

/**
 * Comprueba que el DNI está verificado por admin (obligatorio para reservar).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ clientMessage?: string }} [options]
 */
export async function assertUserIsDniVerified(supabaseAdmin, userId, options = {}) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("doc_dni_url, dni_estado")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error.message },
    };
  }

  if (isClienteVerificado(data)) {
    return { ok: true };
  }

  const message =
    options.clientMessage || getClienteReservaDniBlockMessage(data);

  return {
    ok: false,
    status: 403,
    body: {
      error: message,
      code: DNI_NOT_VERIFIED_ERROR_CODE,
      redirect: DNI_SUBIR_RUTA,
      dni_estado: getDniRevisionEstado(data),
    },
  };
}
