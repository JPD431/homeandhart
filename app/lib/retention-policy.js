/**
 * Política de retención RGPD — plazos parametrizables.
 *
 * null = desactivado. El abogado rellena los plazos (días).
 * Nunca aplicar a datos contables/consents/ledgers (ver RETENTION_UNTOUCHABLE).
 *
 * Cómo activar cuando haya plazos:
 * 1. Sustituir null por el número de días que indique el abogado.
 * 2. Probar: GET /api/cron/retention?dry_run=true  (Authorization: Bearer CRON_SECRET)
 * 3. Ejecutar de verdad: GET /api/cron/retention?dry_run=false
 * 4. Opcional: añadir en vercel.json:
 *    { "path": "/api/cron/retention", "schedule": "0 4 * * 0" }  // ej. domingo 04:00 UTC
 */

/** Tamaño de lote por job y ejecución. */
export const RETENTION_BATCH_SIZE = 500;

/**
 * Plazos en días. Todo null hasta decisión legal.
 * @type {Record<string, number|null>}
 */
export const RETENTION = {
  MESSAGES_DAYS: null,
  NOTIFICATIONS_READ_DAYS: null,
  EMAIL_LOGS_DAYS: null,
  STRIPE_ALERTS_DAYS: null,
  REPORTS_RESOLVED_DAYS: null,
  FAVORITOS_DAYS: null,
  REFERENCIAS_PENDING_DAYS: null,
  SERVICE_PHOTOS_ORPHAN_DAYS: null,
  INACTIVE_ACCOUNT_DAYS: null,
};

/**
 * Tablas / ámbitos que la maquinaria NUNCA debe borrar ni anonimizar.
 * Salvaguarda en código (además de no tener jobs sobre ellas).
 */
export const RETENTION_UNTOUCHABLE = Object.freeze([
  "bookings", // importes, fechas, estado, payment_intent — obligación contable
  "credito_debitos",
  "credito_abonos",
  "sin_comision_claims",
  "user_consents", // evidencia legal del consentimiento
  // Transferencias / rastro de pago ligado a bookings (no hay job; listado defensivo)
  "bookings.importe_transferido",
  "bookings.pago_liberado_at",
  "bookings.payment_intent_id",
  "bookings.precio_total",
  "bookings.precio_base",
]);

/**
 * Días de gracia tras el email de aviso antes de anonimizar+ban
 * una cuenta inactiva (operativo; no es plazo legal de retención).
 */
export const INACTIVE_WARNING_GRACE_DAYS = 14;

/**
 * @param {unknown} days
 * @param {string} name
 * @returns {number|null} días válidos (>0) o null si desactivado/inválido
 */
export function resolveRetentionDays(days, name = "RETENTION") {
  if (days == null) return null;
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(
      `[retention] ${name}=${JSON.stringify(days)} inválido (≤0 o no numérico) → tratado como desactivado`,
    );
    return null;
  }
  return Math.floor(n);
}

/**
 * @param {number} days
 * @returns {string} ISO cutoff
 */
export function cutoffIsoFromDays(days) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/** Tablas base que ningún job puede mutar. */
export const RETENTION_UNTOUCHABLE_TABLES = Object.freeze([
  "bookings",
  "credito_debitos",
  "credito_abonos",
  "sin_comision_claims",
  "user_consents",
]);

/**
 * Comprueba que un job no declare mutación sobre tablas intocables.
 * @param {string[]} tablesTouched — tablas que el job va a DELETE/UPDATE
 */
export function assertRetentionSafe(tablesTouched = []) {
  const forbidden = new Set(RETENTION_UNTOUCHABLE_TABLES);
  for (const t of tablesTouched) {
    const base = String(t).split(".")[0];
    if (forbidden.has(base)) {
      throw new Error(
        `[retention] SALVAGUARDA: intento de tocar tabla intocable «${base}»`,
      );
    }
  }
}
