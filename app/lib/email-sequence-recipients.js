import { isAdminUserId } from "@/lib/auth/admin";
import { MARKETING_SEQUENCE_TYPES } from "@/app/lib/email-sequences";

/**
 * Emails internos explícitos (nunca secuencias de marketing de usuario).
 * Ampliable con env INTERNAL_EMAILS (CSV). NO filtramos por dominio @homeandheart.es
 * para no bloquear cuentas del equipo que deban recibir secuencias.
 */
const DEFAULT_INTERNAL_EMAILS = ["soporte@homeandheart.es"];

function getInternalEmails() {
  const fromEnv = (process.env.INTERNAL_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_INTERNAL_EMAILS, ...fromEnv]);
}

/**
 * Cuentas admin/internas: no deben recibir secuencias de marketing /
 * reenganche / onboarding / bienvenida de usuario.
 *
 * @param {string | null | undefined} userId
 * @param {string | null | undefined} [email]
 */
export function isExcludedFromUserEmailSequences(userId, email) {
  if (userId && isAdminUserId(String(userId))) {
    return true;
  }

  if (email) {
    const normalized = String(email).trim().toLowerCase();
    if (normalized && getInternalEmails().has(normalized)) {
      return true;
    }
  }

  return false;
}

export function isMarketingSequenceType(tipo) {
  return MARKETING_SEQUENCE_TYPES.includes(tipo);
}
