/** Bucket privado: DNI, antecedentes, NRU y documentos opcionales. */
export const STORAGE_BUCKET_DOCUMENTOS = "Documentos";

/** Bucket público: avatares de perfil y fotos de anuncios/servicios. */
export const STORAGE_BUCKET_MEDIA = "Media";

/**
 * Comprueba que una URL pública apunta al bucket Media (no Documentos).
 * @param {string} url
 * @returns {string}
 */
export function assertMediaPublicUrl(url) {
  if (
    !url ||
    (!url.includes("/object/public/Media/") &&
      !url.includes("/object/public/media/"))
  ) {
    throw new Error(
      "La foto debe almacenarse en el bucket público Media, no en Documentos.",
    );
  }
  if (
    url.includes("/object/public/Documentos/") ||
    url.includes("/object/public/documentos/")
  ) {
    throw new Error("URL de foto apunta al bucket privado Documentos.");
  }
  return url;
}
