/**
 * NRU / licencia turística por servicio de alojamiento.
 * Validación laxa (formatos varían por CCAA); la verificación real la hace un admin.
 */

export const NRU_ESTADOS = ["pendiente", "verificado", "rechazado"];

export const NRU_MIN_LEN = 4;
export const NRU_MAX_LEN = 64;

/** Caracteres permitidos tras el primer alfanumérico. */
const NRU_BODY_RE = /^[A-Za-z0-9][A-Za-z0-9\s\-/.]*$/;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeNru(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, nru: string | null } | { ok: false, error: string }}
 */
export function validateNruLax(value) {
  const nru = normalizeNru(value);
  if (!nru) {
    return {
      ok: false,
      error: "Indica el número de registro turístico (NRU) del alojamiento.",
    };
  }
  if (nru.length < NRU_MIN_LEN || nru.length > NRU_MAX_LEN) {
    return {
      ok: false,
      error: `El NRU debe tener entre ${NRU_MIN_LEN} y ${NRU_MAX_LEN} caracteres.`,
    };
  }
  if (!NRU_BODY_RE.test(nru)) {
    return {
      ok: false,
      error:
        "El NRU solo puede contener letras, números, espacios, guiones, barras o puntos.",
    };
  }
  return { ok: true, nru };
}

/**
 * ¿El servicio de alojamiento tiene NRU verificado por admin?
 * @param {{ vertical?: string, nru?: string | null, nru_estado?: string | null, details?: { nru?: string } } | null | undefined} service
 */
export function isAlojamientoNruVerificado(service) {
  if (!service || service.vertical !== "alojamiento") return true;
  const nru = normalizeNru(service.nru ?? service.details?.nru);
  return Boolean(nru) && service.nru_estado === "verificado";
}

/**
 * ¿Hay que resetear nru_estado a pendiente? (NRU nuevo o distinto).
 * @param {string | null | undefined} previousNru
 * @param {string | null | undefined} nextNru
 */
export function nruChanged(previousNru, nextNru) {
  return normalizeNru(previousNru) !== normalizeNru(nextNru);
}
