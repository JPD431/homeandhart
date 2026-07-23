/**
 * Auth para APIs internas server-to-server (emails, crons, Stripe internos).
 * Fail-closed: si CRON_SECRET no está definido / vacío, NUNCA autentica
 * (evita el agujero `Bearer undefined`).
 */

import { timingSafeEqual } from "crypto";

let missingSecretLogged = false;

export function getInternalApiSecret() {
  const secret = process.env.CRON_SECRET;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

function logMissingCronSecret() {
  if (missingSecretLogged) return;
  missingSecretLogged = true;
  console.error(
    "[internal-api-auth] CRON_SECRET no configurado — denegando auth interna (fail-closed)",
  );
}

/** Comparación timing-safe de dos strings (misma longitud requerida). */
export function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * ¿La request trae Authorization: Bearer <CRON_SECRET> válido?
 * Si el secreto falta → false (nunca acepta "Bearer undefined").
 */
export function isInternalApiAuthorized(request) {
  const secret = getInternalApiSecret();
  if (!secret) {
    logMissingCronSecret();
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  return timingSafeEqualString(authHeader, expected);
}

export function unauthorizedInternalResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Headers para que código server-side llame a /api/emails u otras rutas internas. */
export function internalApiHeaders(extra = {}) {
  const secret = getInternalApiSecret();
  if (!secret) {
    console.error(
      "[internal-api-auth] CRON_SECRET no configurado — no se pueden firmar llamadas internas",
    );
    throw new Error("CRON_SECRET no está configurado");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
    ...extra,
  };
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
}
