import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const LOG = "[rate-limit]";

/** @type {Redis | null | undefined} */
let redisClient;
/** @type {Map<string, Ratelimit>} */
const limiters = new Map();

function hasUpstashEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function getRedis() {
  if (redisClient !== undefined) return redisClient;
  if (!hasUpstashEnv()) {
    console.warn(
      `${LOG} deshabilitado: faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN`,
    );
    redisClient = null;
    return null;
  }
  try {
    redisClient = Redis.fromEnv();
    return redisClient;
  } catch (err) {
    console.error(`${LOG} error creando cliente Redis:`, err?.message || err);
    redisClient = null;
    return null;
  }
}

/**
 * @param {number} limit
 * @param {string} window — ej. "1 m", "15 m" (sintaxis Upstash)
 */
function getLimiter(limit, window) {
  const key = `${limit}:${window}`;
  if (limiters.has(key)) return limiters.get(key);

  const redis = getRedis();
  if (!redis) return null;

  try {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: "hh:rl",
      analytics: false,
    });
    limiters.set(key, limiter);
    return limiter;
  } catch (err) {
    console.error(`${LOG} error creando Ratelimit:`, err?.message || err);
    return null;
  }
}

/**
 * IP real en Vercel (x-forwarded-for → primer hop).
 * @param {Request} request
 */
export function getClientIp(request) {
  try {
    const xff = request.headers?.get?.("x-forwarded-for");
    if (typeof xff === "string" && xff.trim()) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = request.headers?.get?.("x-real-ip");
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  } catch {
    // ignore
  }
  return "unknown";
}

/**
 * Identificador: user id si hay sesión; si no, IP.
 * @param {Request} request
 * @param {string | null | undefined} [userId]
 */
export function getRateLimitIdentifier(request, userId) {
  if (typeof userId === "string" && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  return `ip:${getClientIp(request)}`;
}

/**
 * Comprueba el límite. NUNCA lanza → fail-open si Upstash falla / falta config.
 *
 * @param {string} identifier
 * @param {{ limit: number, window?: string, prefix?: string }} opts
 * @returns {Promise<{ success: boolean, remaining: number, reset: number, disabled?: boolean }>}
 */
export async function checkRateLimit(identifier, opts = {}) {
  const limit = Number(opts.limit);
  const window = typeof opts.window === "string" ? opts.window : "1 m";
  const prefix = typeof opts.prefix === "string" ? opts.prefix : "default";

  if (!Number.isFinite(limit) || limit <= 0) {
    return { success: true, remaining: 999, reset: Date.now(), disabled: true };
  }

  try {
    const limiter = getLimiter(limit, window);
    if (!limiter) {
      return { success: true, remaining: 999, reset: Date.now(), disabled: true };
    }

    const key = `${prefix}:${identifier}`;
    const result = await limiter.limit(key);
    return {
      success: result.success === true,
      remaining: Number(result.remaining) || 0,
      reset: Number(result.reset) || Date.now() + 60_000,
    };
  } catch (err) {
    console.error(
      `${LOG} Upstash falló (fail-open):`,
      err?.message || err,
      { identifier, prefix },
    );
    return { success: true, remaining: 999, reset: Date.now(), disabled: true };
  }
}

/**
 * Respuesta 429 estándar.
 * @param {number} [resetMs]
 */
export function rateLimitExceededResponse(resetMs) {
  const now = Date.now();
  const reset = Number(resetMs) || now + 60_000;
  const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));

  return NextResponse.json(
    { error: "Demasiadas solicitudes, inténtalo en un momento" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    },
  );
}

/**
 * Aplica rate limit. Devuelve NextResponse 429 o null (dejar pasar).
 *
 * @param {Request} request
 * @param {{
 *   limit: number,
 *   window?: string,
 *   prefix: string,
 *   userId?: string | null,
 * }} opts
 * @returns {Promise<NextResponse | null>}
 */
export async function enforceRateLimit(request, opts) {
  try {
    const identifier = getRateLimitIdentifier(request, opts.userId);
    const result = await checkRateLimit(identifier, {
      limit: opts.limit,
      window: opts.window,
      prefix: opts.prefix,
    });
    if (result.success) return null;
    return rateLimitExceededResponse(result.reset);
  } catch (err) {
    console.error(`${LOG} enforce falló (fail-open):`, err?.message || err);
    return null;
  }
}
