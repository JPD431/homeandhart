/** Landings ciudad × servicio (app/[lang]/[ciudad]/[vertical]). */
export const CIUDADES = ["madrid", "barcelona", "valencia", "sevilla", "bilbao"];
export const VERTICALES_LANDING = ["nineras", "alojamiento", "mascotas"];

/**
 * Ciudades que se indexan y salen en el sitemap. Hoy solo hay cobertura real en
 * Madrid (ver home y /garantia); el resto queda en noindex hasta tener proveedores
 * y contenido local verificado.
 * TODO(SEO): añadir una ciudad aquí solo cuando tenga cobertura y contenido propio.
 */
export const CIUDADES_INDEXABLES = ["madrid"];
