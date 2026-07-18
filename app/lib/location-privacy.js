/**
 * Privacidad de ubicación y contacto del proveedor.
 *
 * Público (búsqueda, anuncio, perfil proveedor, comparar…):
 *   NUNCA exponer direccion_exacta, telefono_contacto ni location_lat/lng exactos.
 *
 * Legítimo (dueño, admin preview, reserva confirmada, emails server-side):
 *   sí pueden leer esos campos.
 */

/** Columnas que no deben viajar en respuestas públicas. */
export const SERVICE_PRIVATE_COLUMNS = [
  "direccion_exacta",
  "telefono_contacto",
  "location_lat",
  "location_lng",
];

/**
 * Campos públicos de services para listados / anuncio / perfil.
 * Sin dirección exacta, teléfono ni coordenadas precisas.
 */
export const SERVICE_PUBLIC_COLUMNS = `
  id,
  titulo,
  vertical,
  precio,
  disponible,
  cancellation_policy,
  reserva_inmediata,
  descripcion,
  descripcion_anuncio,
  foto_url,
  fotos,
  tipo_alojamiento,
  modalidad,
  location_zone,
  ciudad,
  proveedor_id,
  oferta_descuento,
  oferta_valida_hasta,
  oferta_titulo,
  oferta_descripcion,
  disponible_para_viajar,
  capacidad,
  capacidad_maxima,
  huespedes_incluidos,
  precio_huesped_extra,
  amenities,
  jardin,
  paseos_incluidos,
  fotos_actualizaciones,
  mascotas_detalle,
  ninos_detalle,
  normas,
  check_in,
  check_out,
  estancia_minima,
  estancia_maxima,
  antelacion_minima,
  dias_disponibles,
  proveedor_emergencia,
  anos_experiencia,
  revision_estado,
  nru
`.replace(/\s+/g, " ").trim();

export const SERVICE_PUBLIC_PROFILE_EMBED = `
  profiles_public!inner (
    id,
    nombre,
    apellido,
    foto_perfil,
    foto_url,
    descripcion,
    ciudad,
    location_zone,
    verificado,
    idiomas,
    badge_respuesta
  )
`.trim();

/** Select completo para anuncio / carga pública por id. */
export const SERVICE_PUBLIC_SELECT = `
  ${SERVICE_PUBLIC_COLUMNS},
  ${SERVICE_PUBLIC_PROFILE_EMBED}
`;

/**
 * Elimina campos privados si alguien hizo select('*') por error.
 * Defensa en profundidad; la query no debería haberlos pedido.
 */
export function stripPrivateServiceFields(service) {
  if (!service || typeof service !== "object") return service;
  const cleaned = { ...service };
  for (const key of SERVICE_PRIVATE_COLUMNS) {
    delete cleaned[key];
  }
  return cleaned;
}

/** Radio del círculo aproximado en el mapa público (~600 m, estilo Airbnb). */
export const PUBLIC_MAP_RADIUS_METERS = 600;

/**
 * Centro aproximado para el mapa: geocodifica zona/ciudad (barrio), nunca la calle.
 * @param {{ location_zone?: string, ciudad?: string, profiles_public?: object }} service
 * @param {string} [mapboxToken]
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function resolvePublicMapCenter(service, mapboxToken) {
  const token = mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !service) return null;

  const profile = Array.isArray(service.profiles_public)
    ? service.profiles_public[0]
    : service.profiles_public;

  const zone =
    String(service.location_zone || profile?.location_zone || "").trim() ||
    null;
  const ciudad =
    String(service.ciudad || profile?.ciudad || "").trim() || null;

  const queryParts = [zone, ciudad, "España"].filter(Boolean);
  if (queryParts.length < 2) return null;

  const query = queryParts.join(", ");
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=es&types=neighborhood,locality,place,district`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const center = data.features?.[0]?.center;
    if (!Array.isArray(center) || center.length < 2) return null;
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}

/**
 * GeoJSON polígono círculo (aprox.) alrededor de un punto.
 * @param {number} lng
 * @param {number} lat
 * @param {number} radiusMeters
 * @param {number} [steps]
 */
export function circlePolygon(lng, lat, radiusMeters, steps = 64) {
  const coords = [];
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angular = radiusMeters / earthRadius;

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angular) +
        Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}
