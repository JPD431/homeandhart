/**
 * Completitud de anuncio (calidad / destacar) — distinto de blockers de activación.
 * Enfocado en alojamiento; otras verticales usan un subconjunto.
 */

import { parseFotosFromDb } from "@/app/lib/service-photos";
import { getServiceDireccionExacta } from "@/app/lib/provider-publicacion";
import { alojamientoNruPublishReady } from "@/app/lib/provider-documents";
import { buildEditarPerfilTabHref } from "@/app/lib/editar-perfil-routes";
import { hasEmailContacto, hasTelefono } from "@/app/lib/profile-telefono";

export const FOTOS_RECOMENDADAS = 3;

const CALENDAR_SEEN_PREFIX = "hh_calendar_seen_";

/** @param {string|null|undefined} serviceId */
export function calendarSeenStorageKey(serviceId) {
  return `${CALENDAR_SEEN_PREFIX}${serviceId || ""}`;
}

/** @param {string|null|undefined} serviceId */
export function markCalendarReviewed(serviceId) {
  if (!serviceId || typeof window === "undefined") return;
  try {
    localStorage.setItem(calendarSeenStorageKey(serviceId), "1");
    window.dispatchEvent(
      new CustomEvent("hh-calendar-reviewed", { detail: { serviceId } }),
    );
  } catch {
    /* ignore */
  }
}

/** @param {string|null|undefined} serviceId */
export function hasCalendarReviewed(serviceId) {
  if (!serviceId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(calendarSeenStorageKey(serviceId)) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {object} service — fila mapeada o draft con details / fotos
 * @returns {number}
 */
export function countServiceFotos(service) {
  if (!service) return 0;
  const fromDetails = parseFotosFromDb({
    fotos: service.details?.fotos ?? service.fotos,
    foto_url: service.details?.foto_url ?? service.foto_url,
  });
  return fromDetails.length;
}

/**
 * @param {object} service
 * @returns {string}
 */
export function getServiceDescripcion(service) {
  const raw = service?.details?.descripcion ?? service?.descripcion ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * @param {object} service
 * @returns {boolean}
 */
export function hasPrecioBase(service) {
  const raw = service?.details?.precio ?? service?.precio;
  if (raw === "" || raw == null) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0;
}

/**
 * @param {object} service — details o draft de wizard
 * @param {{ documentContext?: object, calendarReviewed?: boolean, hasCalendarData?: boolean }} [opts]
 */
export function getAlojamientoListingCompleteness(service, opts = {}) {
  const {
    documentContext = null,
    calendarReviewed = false,
    hasCalendarData = false,
  } = opts;

  const fotosCount = countServiceFotos(service);
  const descripcionOk = getServiceDescripcion(service).length >= 40;
  const direccionOk = Boolean(getServiceDireccionExacta(service));
  const precioOk = hasPrecioBase(service);
  const nruPdfOk = documentContext
    ? alojamientoNruPublishReady(documentContext)
    : false;
  const calendarOk = calendarReviewed || hasCalendarData;

  /** @type {Array<{ id: string, label: string, done: boolean, required: boolean, optional?: boolean, hint?: string, section?: string }>} */
  const items = [
    {
      id: "fotos",
      label:
        fotosCount >= FOTOS_RECOMENDADAS
          ? `Fotos (${fotosCount})`
          : `Fotos (recomendado ≥${FOTOS_RECOMENDADAS})`,
      done: fotosCount >= FOTOS_RECOMENDADAS,
      required: true,
      hint:
        fotosCount === 0
          ? "Añade al menos una foto; idealmente 3 o más."
          : fotosCount < FOTOS_RECOMENDADAS
            ? `Llevas ${fotosCount}. Con ${FOTOS_RECOMENDADAS}+ destaca más.`
            : null,
      section: "fotos",
    },
    {
      id: "descripcion",
      label: "Descripción del anuncio",
      done: descripcionOk,
      required: true,
      hint: descripcionOk
        ? null
        : "Cuenta qué hace especial tu alojamiento (unas líneas).",
      section: "basicos",
    },
    {
      id: "direccion",
      label: "Dirección exacta",
      done: direccionOk,
      required: true,
      hint: direccionOk
        ? null
        : "Necesaria para activar el anuncio; solo se comparte tras reservar.",
      section: "direccion",
    },
    {
      id: "precio",
      label: "Precio base por noche",
      done: precioOk,
      required: true,
      section: "basicos",
    },
    {
      id: "nru_pdf",
      label: "PDF de resolución NRU",
      done: nruPdfOk,
      required: true,
      hint: nruPdfOk
        ? null
        : "Obligatorio para publicar. Súbelo en Documentos o al editar el anuncio.",
      section: "documentos",
    },
    {
      id: "calendario",
      label: "Revisa calendario y precios por temporada",
      done: calendarOk,
      required: false,
      optional: true,
      hint: calendarOk
        ? null
        : "Bloquea fechas no disponibles y marca precios especiales por día.",
      section: "calendario",
    },
    {
      id: "promos",
      label: "Configura promociones (opcional)",
      done: false,
      required: false,
      optional: true,
      hint: "Oferta especial o descuentos por estancia larga.",
      section: "promos",
    },
    {
      id: "emergencia",
      label: "¿Proveedor de emergencia? (opcional)",
      done: service?.details?.proveedor_emergencia === true,
      required: false,
      optional: true,
      hint: "Apareces como alternativa si otro proveedor cancela a última hora.",
      section: "emergencia",
    },
  ];

  // Promos: marcar done si ya tienen oferta o descuentos activos
  const promosItem = items.find((i) => i.id === "promos");
  if (promosItem) {
    const d = service?.details || service || {};
    promosItem.done =
      d.oferta_activa === true || d.descuentos_duracion_activa === true;
  }

  const scored = items.filter((i) => i.required || i.id === "calendario");
  const doneCount = scored.filter((i) => i.done).length;
  const totalCount = scored.length;
  const pct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

  const isWeak =
    fotosCount === 0 || !direccionOk || !calendarOk;

  return {
    items,
    fotosCount,
    doneCount,
    totalCount,
    pct,
    isWeak,
    serviceId: service?.id || null,
    titulo: String(service?.details?.titulo || service?.titulo || "").trim(),
  };
}

/**
 * Href para editar un anuncio (opcionalmente saltar a una sección).
 * @param {string} serviceId
 * @param {string} [section]
 */
export function listingEditHref(serviceId, section) {
  return buildEditarPerfilTabHref("servicios", { serviceId, section });
}

/**
 * Pendientes post-onboarding para la pantalla de confirmación.
 * @param {{
 *   perfil: object|null,
 *   accountEmail?: string|null,
 *   services: object[],
 *   documentContext?: object|null,
 *   calendarByServiceId?: Record<string, boolean>,
 * }} input
 */
export function buildPostOnboardingPendingSteps({
  perfil,
  accountEmail = null,
  services = [],
  documentContext = null,
  calendarByServiceId = {},
}) {
  /** @type {Array<{ id: string, label: string, href: string, actor: 'proveedor'|'equipo', done?: boolean }>} */
  const steps = [];

  const contactoOk =
    hasTelefono(perfil) && hasEmailContacto(perfil, accountEmail);
  if (!contactoOk) {
    steps.push({
      id: "contacto",
      label: "Añade tu teléfono de contacto",
      href: "/editar-perfil?tab=perfil",
      actor: "proveedor",
    });
  }

  if (perfil?.cobros_activos !== true) {
    steps.push({
      id: "cobros",
      label: "Configura tus cobros (Stripe) para recibir pagos",
      href: "/dashboard?tab=proveedor",
      actor: "proveedor",
    });
  }

  const alojamientos = services.filter((s) => s.vertical === "alojamiento");
  for (const svc of alojamientos) {
    const cal =
      calendarByServiceId[svc.id] === true ||
      hasCalendarReviewed(svc.id);
    const c = getAlojamientoListingCompleteness(svc, {
      documentContext,
      calendarReviewed: cal,
    });
    if (c.isWeak || c.pct < 100) {
      const missing = c.items
        .filter((i) => i.required && !i.done)
        .map((i) => i.label.replace(/\s*\(.*\)/, ""))
        .slice(0, 3);
      const title = c.titulo || "tu alojamiento";
      steps.push({
        id: `listing-${svc.id || title}`,
        label:
          missing.length > 0
            ? `Completa el anuncio «${title}» (${missing.join(", ").toLowerCase()})`
            : `Revisa el anuncio «${title}» (calendario y detalles)`,
        href: svc.id
          ? listingEditHref(svc.id)
          : "/editar-perfil?tab=servicios",
        actor: "proveedor",
      });
    }
  }

  const dniSubido = Boolean(
    perfil?.doc_dni_url ||
      (typeof perfil?.dni_estado === "string" &&
        perfil.dni_estado !== "sin_documento"),
  );
  const dniOk = perfil?.dni_estado === "verificado";
  if (dniSubido && !dniOk && perfil?.dni_estado !== "rechazado") {
    steps.push({
      id: "dni-revision",
      label: "Estamos verificando tu DNI (equipo)",
      href: "/dashboard?tab=proveedor",
      actor: "equipo",
    });
  } else if (!dniSubido) {
    steps.push({
      id: "dni-subir",
      label: "Sube tu DNI, NIE o pasaporte",
      href: "/subir-dni",
      actor: "proveedor",
    });
  }

  const nruPendiente = alojamientos.some(
    (s) => s.nru_estado !== "verificado" && (s.nru || s.details?.nru),
  );
  if (nruPendiente) {
    steps.push({
      id: "nru-revision",
      label: "Estamos verificando tu NRU de alojamiento (equipo)",
      href: "/dashboard?tab=proveedor",
      actor: "equipo",
    });
  }

  return steps;
}

/**
 * Aviso de calidad al enviar el wizard (no bloqueante).
 * @param {{ verticales: string[], serviceDetails: Record<string, object> }} input
 * @returns {string[]}
 */
export function getWizardQualityGaps({ verticales = [], serviceDetails = {} }) {
  const gaps = [];
  if (!verticales.includes("alojamiento")) return gaps;
  const d = serviceDetails.alojamiento || {};
  const fotos = parseFotosFromDb({ fotos: d.fotos, foto_url: d.foto_url });
  if (fotos.length === 0) gaps.push("al menos 1 foto");
  if (!String(d.direccion_exacta || "").trim()) gaps.push("dirección exacta");
  return gaps;
}
