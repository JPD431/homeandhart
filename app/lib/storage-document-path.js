/** Bucket privado de documentos del proveedor (DNI, antecedentes, NRU, etc.). */
export const STORAGE_BUCKET_DOCUMENTOS = "Documentos";

/** @deprecated Usar STORAGE_BUCKET_DOCUMENTOS */
export const STORAGE_BUCKET = STORAGE_BUCKET_DOCUMENTOS;

/** TTL por defecto para signed URLs del admin (10 min). */
export const ADMIN_SIGNED_URL_TTL = 600;

/**
 * Extrae la ruta relativa dentro del bucket a partir de un valor en BD:
 * - Path directo (nuevo): "userId/doc_dni_url-123.pdf"
 * - URL pública antigua: ".../object/public/Documentos/userId/..."
 * - URL firmada o privada de Supabase
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
