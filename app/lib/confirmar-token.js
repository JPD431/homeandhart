import { createHmac, timingSafeEqual } from "crypto";

function getSecret() {
  return process.env.CONFIRM_TOKEN_SECRET || process.env.CRON_SECRET || "";
}

export function firmarTokenConfirmacion(bookingId) {
  const secret = getSecret();
  if (!secret || !bookingId) return null;

  return createHmac("sha256", secret)
    .update(String(bookingId))
    .digest("hex");
}

export function verificarTokenConfirmacion(bookingId, token) {
  if (!bookingId || !token || typeof token !== "string") return false;

  const expected = firmarTokenConfirmacion(bookingId);
  if (!expected) return false;

  try {
    const received = Buffer.from(token, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (received.length !== expectedBuf.length) return false;
    return timingSafeEqual(received, expectedBuf);
  } catch {
    return false;
  }
}
