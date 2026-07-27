import { createHmac, timingSafeEqual } from "crypto";

/**
 * Ventana del enlace de confirmación post-servicio.
 * El email pide respuesta en 24h y el cron auto-libera a las 24h;
 * 48h da margen por retrasos de email / reloj sin dejar tokens eternos.
 */
export const CONFIRM_TOKEN_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function getSecret() {
  return process.env.CONFIRM_TOKEN_SECRET || process.env.CRON_SECRET || "";
}

function buildPayload(bookingId, paymentIntentId, issuedAt) {
  // paymentIntentId vacío = reserva sin PI (p.ej. solo crédito); sigue atado al booking.
  return `${String(bookingId)}\n${String(paymentIntentId || "")}\n${String(issuedAt)}`;
}

/**
 * Token: `${issuedAtMs}.${hmacHex}`
 * HMAC firma bookingId + paymentIntentId + issuedAt → no reutilizable con otro PI.
 */
export function firmarTokenConfirmacion(
  bookingId,
  paymentIntentId,
  issuedAt = Date.now(),
) {
  const secret = getSecret();
  if (!secret || !bookingId) return null;

  const ts = Number(issuedAt);
  if (!Number.isFinite(ts)) return null;

  const sig = createHmac("sha256", secret)
    .update(buildPayload(bookingId, paymentIntentId, ts))
    .digest("hex");

  return `${ts}.${sig}`;
}

/**
 * Verifica HMAC (timing-safe), atadura a paymentIntentId y expiración.
 */
export function verificarTokenConfirmacion(
  bookingId,
  paymentIntentId,
  token,
  {
    maxAgeMs = CONFIRM_TOKEN_MAX_AGE_MS,
    now = Date.now(),
  } = {},
) {
  if (!bookingId || !token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [issuedAtRaw, receivedSig] = parts;
  if (!/^\d+$/.test(issuedAtRaw) || !/^[0-9a-f]+$/i.test(receivedSig)) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;
  if (issuedAt > now + 60_000) return false; // rechazo si issuedAt está en el futuro (>1 min)
  if (now - issuedAt > maxAgeMs) return false;

  const expected = firmarTokenConfirmacion(bookingId, paymentIntentId, issuedAt);
  if (!expected) return false;

  const expectedSig = expected.split(".")[1];
  if (!expectedSig) return false;

  try {
    const received = Buffer.from(receivedSig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (received.length !== expectedBuf.length) return false;
    return timingSafeEqual(received, expectedBuf);
  } catch {
    return false;
  }
}
