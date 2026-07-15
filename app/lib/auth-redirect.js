/**
 * Redirect seguro tras login/registro (solo rutas internas, sin open redirect).
 */

export const AUTH_REDIRECT_STORAGE_KEY = "hh_auth_redirect";

/**
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export function isValidInternalRedirect(path) {
  if (!path || typeof path !== "string") return null;

  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  if (trimmed.includes("\\")) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/login") || lower.startsWith("/registro")) return null;

  return trimmed;
}

/**
 * Lee `redirect` o `next` (legacy) de search params.
 * @param {URLSearchParams | { get: (key: string) => string | null }} searchParams
 */
export function getRedirectFromSearchParams(searchParams) {
  if (!searchParams?.get) return null;
  const raw =
    searchParams.get("redirect") ?? searchParams.get("next");
  return isValidInternalRedirect(raw);
}

/** @param {string | null | undefined} intendedPath */
export function buildLoginUrl(intendedPath) {
  const safe = isValidInternalRedirect(intendedPath);
  if (!safe) return "/login";
  return `/login?redirect=${encodeURIComponent(safe)}`;
}

/**
 * @param {string | null | undefined} intendedPath
 * @param {Record<string, string | null | undefined>} [extraParams]
 */
export function buildRegistroUrl(intendedPath, extraParams = {}) {
  const params = new URLSearchParams();
  const safe = isValidInternalRedirect(intendedPath);
  if (safe) params.set("redirect", safe);

  for (const [key, value] of Object.entries(extraParams)) {
    if (value) params.set(key, value);
  }

  const qs = params.toString();
  return qs ? `/registro?${qs}` : "/registro";
}

/** Guarda destino para flujos con verificación de email (mismo navegador). */
export function persistAuthRedirect(path) {
  const safe = isValidInternalRedirect(path);
  if (!safe || typeof window === "undefined") return;

  try {
    sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, safe);
  } catch {
    /* quota / private mode */
  }
}

/** Lee destino guardado sin borrarlo. */
export function peekAuthRedirect() {
  if (typeof window === "undefined") return null;

  try {
    return isValidInternalRedirect(
      sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/** Lee y borra destino guardado. */
export function consumeAuthRedirect() {
  const path = peekAuthRedirect();
  if (typeof window === "undefined") return path;

  try {
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }

  return path;
}

/**
 * Destino tras autenticación: URL (?redirect / ?next) > sessionStorage > default.
 * @param {URLSearchParams | { get: (key: string) => string | null }} searchParams
 * @param {(() => Promise<string> | string) | string} [fetchDefault]
 */
export async function resolveAuthRedirect(searchParams, fetchDefault) {
  const fromUrl = getRedirectFromSearchParams(searchParams);
  if (fromUrl) {
    consumeAuthRedirect();
    return fromUrl;
  }

  const fromStorage = consumeAuthRedirect();
  if (fromStorage) return fromStorage;

  if (typeof fetchDefault === "function") {
    return fetchDefault();
  }

  if (typeof fetchDefault === "string" && fetchDefault.length > 0) {
    return fetchDefault;
  }

  return "/completar-perfil";
}
