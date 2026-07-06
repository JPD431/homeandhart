/** Bucket privado de documentos del proveedor. */
export const STORAGE_BUCKET = "Documentos";

/** TTL por defecto para signed URLs del admin (10 min). */
export const ADMIN_SIGNED_URL_TTL = 600;

/**
 * Extrae la ruta relativa dentro del bucket a partir de una URL almacenada en BD
 * (pública, firmada o path directo).
 * @param {string | null | undefined} storedValue
 * @returns {string | null}
 */
export function extractStoragePath(storedValue) {
  if (!storedValue) return null;

  const publicMatch =
    storedValue.match(/\/object\/public\/Documentos\/(.+)$/i) ||
    storedValue.match(/\/object\/public\/documentos\/(.+)$/i);
  if (publicMatch) {
    return decodeURIComponent(publicMatch[1].split("?")[0]);
  }

  const signedMatch = storedValue.match(
    /\/object\/sign\/Documentos\/(.+?)(\?|$)/i,
  );
  if (signedMatch) {
    return decodeURIComponent(signedMatch[1]);
  }

  const privateMatch = storedValue.match(/\/object\/Documentos\/(.+?)(\?|$)/i);
  if (privateMatch) {
    return decodeURIComponent(privateMatch[1]);
  }

  return storedValue.replace(/^\/+/, "");
}

/**
 * @param {string | null | undefined} path
 * @returns {boolean}
 */
export function isAllowedStoragePath(path) {
  if (!path || typeof path !== "string") return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  return true;
}
