/**
 * Modo cerrado de pagos reales vía PAGOS_SOLO_EMAILS.
 * - Variable ausente o vacía → abierto a todos.
 * - Lista de emails (coma) → solo esos usuarios pueden iniciar/confirmar pagos.
 */

function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * @returns {string[] | null} allowlist en minúsculas, o null si modo abierto.
 */
export function getPagosAllowlist(
  envValue = process.env.PAGOS_SOLO_EMAILS,
) {
  if (envValue == null) return null;
  const raw = String(envValue).trim();
  if (!raw) return null;

  const list = raw
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);

  return list.length === 0 ? null : list;
}

/**
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isPagoPermitido(email) {
  const list = getPagosAllowlist();
  if (list == null) return true;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return list.includes(normalized);
}

export const PAGOS_CERRADOS_CODE = "PAGOS_CERRADOS";
export const PAGOS_CERRADOS_ERROR =
  "Los pagos aún no están abiertos al público.";
