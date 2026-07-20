/**
 * Teléfono de usuario (profiles.telefono).
 * Obligatorio para clientes al reservar y (Paso 2) para proveedores al activar.
 */

export const TELEFONO_REQUIRED_ERROR_CODE = "telefono_required";

export const TELEFONO_REQUIRED_CLIENT_MSG =
  "Añade tu teléfono para poder reservar. Lo compartiremos con el proveedor al confirmar.";

export const TELEFONO_REQUIRED_PROVIDER_MSG =
  "Añade tu teléfono para poder publicar servicios.";

export const TELEFONO_BANNER_CLIENT_MSG =
  "Completa tu teléfono para poder reservar y que el proveedor pueda contactarte.";

export const TELEFONO_INVALID_MSG =
  "Introduce un teléfono válido (mínimo 9 dígitos).";

/**
 * Normaliza a dígitos (+ opcional al inicio).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeTelefono(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  // Conservar + inicial; resto solo dígitos
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
