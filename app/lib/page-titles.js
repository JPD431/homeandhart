/**
 * Títulos de página estáticos ES/EN. Los metadatos de Next se generan en el
 * servidor (siempre en español); LangDocumentSync usa este mapa para mostrar
 * el título en el idioma elegido por el usuario (preferencia guardada en cliente).
 * Los valores ES deben coincidir con el <title> final (incluye el sufijo del template).
 */
const SUFFIX = " · Home&Heart";

export const PAGE_TITLES = [
  {
    es: "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
    en: "Home&Heart · Accommodation, childcare and pet care in one place",
  },
  {
    es: `Buscar proveedores verificados${SUFFIX}`,
    en: `Find verified providers${SUFFIX}`,
  },
  {
    es: `Garantía Home&Heart · Alternativa verificada si tu proveedor cancela${SUFFIX}`,
    en: `Home&Heart Guarantee · Verified alternative if your provider cancels${SUFFIX}`,
  },
  { es: `Nuestra historia${SUFFIX}`, en: `Our story${SUFFIX}` },
  {
    es: `Hazte proveedor · Gana con lo que ya sabes hacer${SUFFIX}`,
    en: `Become a provider · Earn doing what you already know${SUFFIX}`,
  },
  { es: `Aviso legal${SUFFIX}`, en: `Legal notice${SUFFIX}` },
  { es: `Política de cookies${SUFFIX}`, en: `Cookie policy${SUFFIX}` },
  { es: `Política de privacidad${SUFFIX}`, en: `Privacy policy${SUFFIX}` },
  { es: `Términos de uso${SUFFIX}`, en: `Terms of use${SUFFIX}` },
];

const ES_TO_EN = new Map(PAGE_TITLES.map((p) => [p.es, p.en]));
const EN_TO_ES = new Map(PAGE_TITLES.map((p) => [p.en, p.es]));

/** Devuelve el título en `lang`, o el mismo si no hay traducción conocida. */
export function translateTitle(title, lang) {
  if (lang === "en") return ES_TO_EN.get(title) ?? title;
  return EN_TO_ES.get(title) ?? title;
}
