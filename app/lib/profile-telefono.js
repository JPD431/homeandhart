/**
 * Teléfono de usuario (profiles.telefono) y email de contacto (profiles.email_contacto).
 * Cliente: teléfono al reservar (Paso 1).
 * Proveedor: teléfono + email_contacto al activar (Paso 2).
 */

export const TELEFONO_REQUIRED_ERROR_CODE = "telefono_required";
export const EMAIL_CONTACTO_REQUIRED_ERROR_CODE = "email_contacto_required";
export const DIRECCION_REQUIRED_ERROR_CODE = "direccion_required";

export const TELEFONO_REQUIRED_CLIENT_MSG =
  "Añade tu teléfono para poder reservar. Lo compartiremos con el proveedor al confirmar.";

export const TELEFONO_REQUIRED_PROVIDER_MSG =
  "Añade tu teléfono para activar este servicio.";

export const EMAIL_CONTACTO_REQUIRED_PROVIDER_MSG =
  "Añade un email de contacto para activar este servicio.";

export const DIRECCION_REQUIRED_PROVIDER_MSG =
  "Añade la dirección del servicio para poder activarlo.";

export const TELEFONO_BANNER_CLIENT_MSG =
  "Completa tu teléfono para poder reservar y que el proveedor pueda contactarte.";

export const PROVIDER_CONTACT_BANNER_MSG =
  "Completa tu teléfono para poder activar servicios.";

export const TELEFONO_INVALID_MSG =
  "Introduce un teléfono válido (mínimo 9 dígitos).";

export const EMAIL_CONTACTO_INVALID_MSG =
  "Introduce un email de contacto válido.";

/**
 * Normaliza a dígitos (+ opcional al inicio).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeTelefono(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Formato razonable: ≥9 dígitos, ≤15 (E.164-ish).
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidTelefono(raw) {
  const normalized = normalizeTelefono(raw);
  if (!normalized) return false;
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

/**
 * @param {{ telefono?: string | null } | null | undefined} profile
 * @returns {boolean}
 */
export function hasTelefono(profile) {
  return isValidTelefono(profile?.telefono);
}

/**
 * Valor limpio para guardar en profiles.telefono, o null si vacío/inválido.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function telefonoForStorage(raw) {
  const normalized = normalizeTelefono(raw);
  if (!isValidTelefono(normalized)) return null;
  return normalized;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeEmailContacto(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

/**
 * Email simple (no RFC completo): local@dominio.tld
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidEmailContacto(raw) {
  const email = normalizeEmailContacto(raw);
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * @param {{ email_contacto?: string | null } | null | undefined} profile
 * @param {string | null | undefined} [accountEmail] — email de auth/login (fallback)
 * @returns {boolean}
 */
export function hasEmailContacto(profile, accountEmail = null) {
  if (isValidEmailContacto(profile?.email_contacto)) return true;
  return isValidEmailContacto(accountEmail);
}

/**
 * Valor a mostrar/editar: email_contacto guardado, o email de cuenta si falta.
 * No inventa texto inválido.
 * @param {{ email_contacto?: string | null } | null | undefined} profile
 * @param {string | null | undefined} accountEmail
 * @returns {string}
 */
export function resolveEmailContactoDraft(profile, accountEmail = null) {
  if (isValidEmailContacto(profile?.email_contacto)) {
    return normalizeEmailContacto(profile.email_contacto);
  }
  if (isValidEmailContacto(accountEmail)) {
    return normalizeEmailContacto(accountEmail);
  }
  return "";
}

/**
 * Para guardar: campo explícito si válido; si vacío, email de cuenta.
 * No pisa un email_contacto distinto ya escrito en el campo.
 * @param {unknown} raw — valor del input
 * @param {string | null | undefined} [accountEmailFallback]
 * @returns {string | null}
 */
export function emailContactoForStorage(raw, accountEmailFallback = null) {
  const fromField = normalizeEmailContacto(raw);
  if (isValidEmailContacto(fromField)) return fromField;
  // Vacío o solo espacios → usar email de cuenta
  if (!fromField && isValidEmailContacto(accountEmailFallback)) {
    return normalizeEmailContacto(accountEmailFallback);
  }
  return null;
}

/**
 * Server: el usuario debe tener profiles.telefono válido.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ clientMessage?: string }} [options]
 */
export async function assertUserHasTelefono(
  supabaseAdmin,
  userId,
  options = {},
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("telefono")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error.message },
    };
  }

  if (hasTelefono(data)) {
    return { ok: true, telefono: normalizeTelefono(data.telefono) };
  }

  return {
    ok: false,
    status: 403,
    body: {
      error: options.clientMessage || TELEFONO_REQUIRED_CLIENT_MSG,
      code: TELEFONO_REQUIRED_ERROR_CODE,
    },
  };
}
