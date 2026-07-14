/** Clave compartida: localStorage (cliente) + cookie (servidor post-login) */
export const MODO_STORAGE_KEY = "hh_modo";

const MODO_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @param {string | null | undefined} value
 * @returns {'cliente' | 'proveedor' | null}
 */
export function parseStoredModo(value) {
  if (value === "proveedor" || value === "cliente") return value;
  return null;
}

/** Cookie para que post-login-redirect lea el último modo en el servidor */
export function writeModoCookie(modo) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${MODO_STORAGE_KEY}=${modo};path=/;max-age=${MODO_COOKIE_MAX_AGE};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearModoCookie() {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${MODO_STORAGE_KEY}=;path=/;max-age=0;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function readStoredModoClient() {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredModo(localStorage.getItem(MODO_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredModoClient(modo) {
  try {
    localStorage.setItem(MODO_STORAGE_KEY, modo);
    writeModoCookie(modo);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('next/headers').ReadonlyRequestCookies} cookieStore
 * @returns {'cliente' | 'proveedor' | null}
 */
export function readStoredModoFromCookies(cookieStore) {
  return parseStoredModo(cookieStore.get(MODO_STORAGE_KEY)?.value);
}
