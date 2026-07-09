/** Límites de fotos por vertical (wizard / editar-perfil). */
export const SERVICE_PHOTO_LIMITS = {
  alojamiento: 8,
  ninos: 6,
  mascotas: 6,
};

export function getServicePhotoLimit(vertical) {
  return SERVICE_PHOTO_LIMITS[vertical] ?? 6;
}

/**
 * Normaliza un array de URLs: trim, quita vacíos, deduplica manteniendo el orden.
 * @param {unknown} fotos
 * @param {string|null|undefined} [fotoUrlFallback]
 * @returns {string[]}
 */
export function normalizeFotosArray(fotos, fotoUrlFallback = null) {
  const source = Array.isArray(fotos) ? fotos : [];
  const seen = new Set();
  const result = [];

  for (const entry of source) {
    if (typeof entry !== "string") continue;
    const url = entry.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  if (result.length === 0 && typeof fotoUrlFallback === "string") {
    const fallback = fotoUrlFallback.trim();
    if (fallback) result.push(fallback);
  }

  return result;
}

/**
 * Lee fotos desde una fila de BD (jsonb) con fallback a foto_url legacy.
 * @param {object|null|undefined} row
 * @returns {string[]}
 */
export function parseFotosFromDb(row) {
  if (!row) return [];

  let raw = row.fotos;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }

  return normalizeFotosArray(raw, row.foto_url);
}

/**
 * Única función de escritura: sincroniza fotos[] y foto_url (portada = fotos[0]).
 * @param {object} payload — objeto que se enviará a Supabase
 * @param {unknown} fotos — array de URLs (orden = portada primero)
 * @returns {object} payload mutado
 */
export function syncServicePhotos(payload, fotos) {
  const normalized = normalizeFotosArray(fotos, payload?.foto_url);
  payload.fotos = normalized;
  payload.foto_url = normalized[0] ?? null;
  return payload;
}

/**
 * Estado del formulario (details): fotos + foto_url sincronizados.
 * @param {object} details
 * @returns {{ fotos: string[], foto_url: string }}
 */
export function syncDetailsPhotos(details) {
  const fotos = normalizeFotosArray(details?.fotos, details?.foto_url);
  return {
    ...details,
    fotos,
    foto_url: fotos[0] ?? "",
  };
}
