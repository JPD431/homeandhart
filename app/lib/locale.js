/**
 * Rutas por idioma: ES es el idioma por defecto y NO lleva prefijo (/buscar);
 * EN va bajo /en (/en/buscar). El segmento real es app/[lang]; el proxy reescribe
 * las URLs sin prefijo a /es/....
 */
export const LOCALES = ["es", "en"];
export const DEFAULT_LOCALE = "es";

export function isLocale(value) {
  return LOCALES.includes(value);
}

/** "/en/buscar" -> { lang: "en", path: "/buscar" }; "/buscar" -> { lang: "es", path: "/buscar" } */
export function stripLocale(pathname = "/") {
  const match = pathname.match(/^\/(es|en)(?=\/|$)/);
  if (!match) return { lang: DEFAULT_LOCALE, path: pathname || "/" };
  return { lang: match[1], path: pathname.slice(match[0].length) || "/" };
}

/** Prefija una ruta interna con el idioma. Ignora URLs externas, anclas puras, /api y ficheros. */
export function localizeHref(href, lang) {
  if (typeof href !== "string" || lang !== "en") return href;
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (href === "/en" || href.startsWith("/en/") || href.startsWith("/en?") || href.startsWith("/en#")) {
    return href;
  }
  if (href.startsWith("/api/")) return href;
  if (/^\/[^?#]*\.[a-z0-9]+(?:[?#]|$)/i.test(href)) return href;
  if (href === "/") return "/en";
  if (href.startsWith("/?") || href.startsWith("/#")) return `/en${href.slice(1)}`;
  return `/en${href}`;
}

/** Ruta equivalente en otro idioma a partir de la ruta actual (con o sin prefijo). */
export function switchLocalePath(pathname, targetLang) {
  const { path } = stripLocale(pathname);
  return localizeHref(path, targetLang);
}
