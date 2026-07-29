import { parseFotosFromDb } from "@/app/lib/service-photos";
import { getVerificadoBadgeTooltip } from "@/app/lib/verification-copy";
import {
  MODALIDAD_COBRO_VALUES,
  getModalidadCobroPriceSuffix,
  legacyModalidadForVertical,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

/** Tema visual por vertical — misma definición que /buscar. */
export const SERVICE_CARD_VERTICAL_THEME = {
  alojamiento: {
    label: "Alojamiento",
    color: "#1d4f91",
    light: "#e8f0fb",
    priceSuffix: "/ noche",
    priceShort: "n",
    gradient: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
  },
  ninos: {
    label: "Cuidado de niños",
    color: "#0e7a5c",
    light: "#e6f4f0",
    priceSuffix: "/ hora",
    priceShort: "h",
    gradient: "linear-gradient(160deg, #a8d5c2, #3d9b86)",
  },
  mascotas: {
    label: "Cuidado de mascotas",
    color: "#c47d1a",
    light: "#fdf3e3",
    priceSuffix: "/ día",
    priceShort: "d",
    gradient: "linear-gradient(160deg, #e8c99a, #b8843a)",
  },
};

export function getServiceCardTheme(vertical) {
  return (
    SERVICE_CARD_VERTICAL_THEME[vertical] ??
    SERVICE_CARD_VERTICAL_THEME.alojamiento
  );
}

export function getServiceCardInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export function formatServiceCardShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

export function formatServiceCardPrice(precio, suffix) {
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${suffix}`;
}

function formatCardEuroAmount(precio) {
  const n = Number(precio);
  if (!Number.isFinite(n)) return null;
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Compacta "/ hora" → "/hora"; deja "/medio día" legible. */
export function compactPriceSuffix(suffix) {
  return String(suffix || "")
    .trim()
    .replace(/^\/\s*/, "/");
}

/**
 * Precio mostrado en tarjeta de búsqueda (solo display; no afecta reserva).
 *
 * Niñera / mascotas (service_modalidades):
 *   - 2+ modalidades activas → "desde X€/[unidad del mínimo]" (hay rango)
 *   - exactamente 1 → "X€/[unidad]" SIN "desde" (precio fijo)
 *   - 0 filas (legacy) → services.precio + unidad legacy, sin "desde"
 * Alojamiento: sin cambios (precio/noche; "desde" solo con tarifas variables).
 *
 * @returns {{
 *   precio: number|null,
 *   suffix: string,
 *   useDesde: boolean,
 *   priceLabel: string,
 *   reservarLabel: string,
 * }}
 */
export function resolveServiceCardPricing(service, lang = "es") {
  const theme = getServiceCardTheme(service?.vertical);
  const verb = lang === "en" ? "Book" : "Reservar";
  const fromWord = lang === "en" ? "from" : "desde";

  const empty = {
    precio: null,
    suffix: "",
    useDesde: false,
    priceLabel: "Consultar",
    reservarLabel: verb,
  };

  if (!service) return empty;

  const vertical = service.vertical;
  let precio = null;
  let suffix = theme.priceSuffix || "";
  let useDesde = false;

  if (supportsModalidadCobro(vertical)) {
    const rows = Array.isArray(service.modalidades) ? service.modalidades : [];
    // Una fila por modalidad (las filas en BD = activas).
    const byModalidad = new Map();
    for (const row of rows) {
      if (!MODALIDAD_COBRO_VALUES.includes(row?.modalidad)) continue;
      const p = Number(row?.precio);
      if (!Number.isFinite(p) || p <= 0) continue;
      const prev = byModalidad.get(row.modalidad);
      if (!prev || p < prev.precio) {
        byModalidad.set(row.modalidad, { modalidad: row.modalidad, precio: p });
      }
    }
    const priced = [...byModalidad.values()];
    const activeCount = priced.length;

    if (activeCount > 0) {
      priced.sort((a, b) => a.precio - b.precio);
      const best = priced[0];
      precio = best.precio;
      suffix = getModalidadCobroPriceSuffix(best.modalidad);
      // "desde" solo si hay rango real (2 o 3 modalidades).
      useDesde = activeCount >= 2;
    } else {
      // Legacy: sin filas en service_modalidades.
      const p = Number(service.precio);
      if (Number.isFinite(p) && p > 0) precio = p;
      const legacy = legacyModalidadForVertical(vertical);
      suffix = legacy
        ? getModalidadCobroPriceSuffix(legacy)
        : theme.priceSuffix;
      useDesde = false;
    }
  } else if (vertical === "alojamiento") {
    const base = Number(service.precio);
    const tarifasMin = Number(service.tarifas_min_precio);
    const hasTarifasMin = Number.isFinite(tarifasMin) && tarifasMin > 0;
    const hasBase = Number.isFinite(base) && base > 0;

    if (hasTarifasMin && hasBase) {
      precio = Math.min(base, tarifasMin);
      useDesde = tarifasMin !== base || service.tarifas_variables === true;
    } else if (hasTarifasMin) {
      precio = tarifasMin;
      useDesde = service.tarifas_variables === true;
    } else if (hasBase) {
      precio = base;
      useDesde = false;
    }
    suffix = theme.priceSuffix || "/ noche";
  } else {
    const p = Number(service.precio);
    if (Number.isFinite(p) && p > 0) precio = p;
    suffix = theme.priceSuffix || "";
  }

  if (precio == null) return empty;

  const compact = compactPriceSuffix(suffix);
  const amount = `${formatCardEuroAmount(precio)}€${compact}`;
  const priceLabel = useDesde ? `${fromWord} ${amount}` : amount;
  const reservarLabel = useDesde
    ? `${verb} ${fromWord} ${amount}`
    : `${verb} · ${amount}`;

  return { precio, suffix, useDesde, priceLabel, reservarLabel };
}

export function getServiceCardZone(service, profile) {
  return (
    service.location_zone ||
    profile?.location_zone ||
    service.ciudad ||
    profile?.ciudad ||
    "Zona"
  );
}

/** Supabase puede devolver profiles_public como objeto o array según la relación. */
export function normalizeServiceProfile(service) {
  if (!service) return {};
  const raw = service.profiles_public;
  if (Array.isArray(raw)) return raw[0] ?? {};
  return raw ?? {};
}

/** Descripción del anuncio: services.descripcion, con fallback a descripcion_anuncio. */
export function getServiceDescription(service) {
  if (!service) return "";
  const primary =
    typeof service.descripcion === "string" ? service.descripcion.trim() : "";
  if (primary) return primary;
  const fallback =
    typeof service.descripcion_anuncio === "string"
      ? service.descripcion_anuncio.trim()
      : "";
  return fallback;
}

/**
 * URLs de fotos del servicio (ordenadas; portada = [0]).
 * Prioriza services.fotos (jsonb); fallback a foto_url legacy.
 */
export function getServicePhotos(service) {
  if (!service) return [];
  return parseFotosFromDb(service);
}

/** URL de portada para tarjetas, emails y SEO. */
export function getServiceCoverPhoto(service) {
  return getServicePhotos(service)[0] ?? null;
}

function hasPetFriendlyInDescription(service) {
  const desc = getServiceDescription(service).toLowerCase();
  return /pet[-_\s]?friendly/i.test(desc);
}

export function serviceDescriptionIsPetFriendly(service) {
  return hasPetFriendlyInDescription(service);
}

/**
 * Tags mostrados en la tarjeta de búsqueda.
 * @param {object} service
 * @param {object} profile
 * @param {string} [lang]
 * @param {{ isPreview?: boolean }} [options]
 */
export function getServiceCardTags(service, profile, lang = "es", options = {}) {
  const tags = [];

  if (service.reserva_inmediata === true) {
    tags.push({ text: "Reserva inmediata ⚡", light: "#fdf3e3", color: "#92400e" });
  } else {
    tags.push({ text: "Reserva con confirmación 🕐", light: "#f7f5f2", color: "#888" });
  }

  if (!options.isPreview && profile?.verificado === true) {
    tags.push({
      text: "Verificado ✓",
      light: "#e8f0fb",
      color: "#163a6b",
      title: getVerificadoBadgeTooltip(lang),
    });
  }

  if (
    service.vertical === "alojamiento" &&
    (service.disponible_para_viajar || hasPetFriendlyInDescription(service))
  ) {
    tags.push({ text: "Pet-friendly 🐾", light: "#e6f4f0", color: "#085041" });
  }

  if (service.vertical === "mascotas" && service.fotos_actualizaciones === true) {
    tags.push({ text: "Envía fotos 📷", light: "#fdf3e3", color: "#92400e" });
  }

  const languages = Array.isArray(profile?.idiomas) ? profile.idiomas : [];
  if (languages[0]) {
    tags.push({ text: languages[0], light: "#f3f3f3", color: "#666" });
  }

  const avalesCount = Number(service.avales_count) || 0;
  if (!options.isPreview && avalesCount > 0) {
    const avalesLabel =
      lang === "en"
        ? `${avalesCount} endorsement${avalesCount !== 1 ? "s" : ""}`
        : `${avalesCount} aval${avalesCount !== 1 ? "es" : ""}`;
    tags.push({ text: avalesLabel, light: "#f7f5f2", color: "#888" });
  }

  return tags;
}

export function buildReservarHref(serviceId, desde, hasta) {
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  const query = params.toString();
  return query ? `/reservar/${serviceId}?${query}` : `/reservar/${serviceId}`;
}

export function buildAnuncioHref(serviceId, desde, hasta) {
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  const query = params.toString();
  return query ? `/anuncio/${serviceId}?${query}` : `/anuncio/${serviceId}`;
}

export function buildAnuncioPreviewHref(serviceId) {
  return `/anuncio/${serviceId}?preview=1`;
}
