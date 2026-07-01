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
 * URLs de fotos del servicio.
 * Hoy en BD solo persiste services.foto_url (text); el wizard preview puede pasar fotos[].
 */
export function getServicePhotos(service) {
  if (!service) return [];
  if (Array.isArray(service.fotos)) {
    return [...new Set(service.fotos.filter(Boolean))];
  }
  if (service.foto_url) return [service.foto_url];
  return [];
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
    tags.push({ text: "Verificado ✓", light: "#e8f0fb", color: "#163a6b" });
  }

  if (
    service.vertical === "alojamiento" &&
    (service.disponible_para_viajar || hasPetFriendlyInDescription(service))
  ) {
    tags.push({ text: "Pet-friendly 🐾", light: "#e6f4f0", color: "#085041" });
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
