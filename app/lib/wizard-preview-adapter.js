import { verticalEmojiLabel } from "@/app/lib/vertical-emojis";
import { resolveAmenities } from "@/app/lib/amenities";
import { getCapacidadDisplayRows, formatCapacidadDisplayRow } from "@/app/lib/capacidad";
import { normalizeCancelPolicy } from "@/app/lib/cancelacion-politica";
import {
  formatServiceCardPrice,
  getServiceCardTheme,
  getServiceDescription,
  getServicePhotos,
} from "@/app/lib/service-card-display";
import {
  formatModalidadesCobroAnuncio,
  resolveDisplayPriceSuffix,
  serializeModalidadesCobroRows,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

const CANCEL_LABELS = {
  flexible: "Flexible",
  moderada: "Moderada",
  estricta: "Estricta",
};

export function getWizardPreviewVerticalHeading(vertical) {
  const labels = {
    alojamiento: "Alojamiento",
    ninos: "Niñera",
    mascotas: "Mascotas",
  };
  const label = labels[vertical];
  return label ? verticalEmojiLabel(vertical, label) : vertical;
}

/**
 * Convierte los datos del wizard en el objeto `service` que espera ServiceCard.
 * @param {string} vertical
 * @param {object} params
 */
export function buildWizardPreviewService(
  vertical,
  {
    serviceDetails,
    nombre,
    apellido,
    ciudad,
    idiomas,
    userId,
  },
) {
  const details = serviceDetails?.[vertical] ?? {};
  const photos = getServicePhotos({
    fotos: details.fotos,
    foto_url: details.foto_url,
  });
  const foto_url = photos[0] || null;

  let modalidades = [];
  if (supportsModalidadCobro(vertical)) {
    const serialized = serializeModalidadesCobroRows(details, vertical);
    if (serialized.ok) modalidades = serialized.rows;
  }

  return {
    id: `preview-${vertical}`,
    proveedor_id: userId || "preview",
    vertical,
    titulo: details.titulo?.trim() || "",
    descripcion: getServiceDescription({
      descripcion: details.descripcion,
      descripcion_anuncio: details.descripcion_anuncio,
    }),
    descripcion_anuncio: details.descripcion_anuncio?.trim() || "",
    precio: details.precio ?? "",
    modalidades,
    foto_url,
    fotos: photos,
    amenities: Array.isArray(details.amenities) ? details.amenities : [],
    location_zone: details.location_zone?.trim() || "",
    ciudad: ciudad?.trim() || "",
    reserva_inmediata: details.reserva_inmediata === true,
    disponible_para_viajar: details.disponible_para_viajar === true,
    tipo_alojamiento: details.tipo_alojamiento || "",
    modalidad: details.modalidad || "",
    cancellation_policy: details.cancelacion || "moderada",
    capacidad: details.capacidad ?? null,
    jardin: details.jardin === true,
    paseos_incluidos: details.paseosIncluidos === true,
    fotos_actualizaciones: details.fotosActualizaciones === true,
    mascotas_detalle: {
      cerca_veterinario: details.cercaVeterinario === true,
    },
    profiles_public: {
      id: userId || "preview",
      nombre: nombre?.trim() || "",
      apellido: apellido?.trim() || "",
      ciudad: ciudad?.trim() || "",
      location_zone: details.location_zone?.trim() || ciudad?.trim() || "",
      idiomas: Array.isArray(idiomas) ? idiomas : [],
      verificado: false,
      badge_respuesta: null,
    },
  };
}

/**
 * @param {string[]} verticales
 * @param {object} wizardState
 * @returns {ReturnType<typeof buildWizardPreviewService>[]}
 */
export function buildWizardPreviewServices(verticales, wizardState) {
  const unique = [...new Set(verticales)];
  return unique.map((vertical) =>
    buildWizardPreviewService(vertical, wizardState),
  );
}

/**
 * Mini-resumen bajo cada tarjeta en el paso preview.
 * @param {string} vertical
 * @param {object} details — serviceDetails[vertical]
 * @returns {{ label: string, value: string }[]}
 */
export function getWizardPreviewSummary(vertical, details = {}) {
  const theme = getServiceCardTheme(vertical);
  const items = [];
  const priceSuffix = supportsModalidadCobro(vertical)
    ? resolveDisplayPriceSuffix({ vertical })
    : theme.priceSuffix;

  items.push({
    label: "Precio",
    value: formatServiceCardPrice(details.precio, priceSuffix),
  });

  let modalidades = [];
  if (supportsModalidadCobro(vertical)) {
    const serialized = serializeModalidadesCobroRows(details, vertical);
    if (serialized.ok) modalidades = serialized.rows;
  }
  const cobroLine = formatModalidadesCobroAnuncio(
    { vertical, precio: details.precio, modalidades },
    modalidades,
  );
  if (cobroLine) {
    items.push({ label: "Cobro", value: cobroLine });
  }

  if (vertical === "alojamiento") {
    const rows = getCapacidadDisplayRows({ capacidad: details.capacidad });
    if (rows.length > 0) {
      items.push({
        label: "Capacidad",
        value: rows.map(formatCapacidadDisplayRow).join(" · "),
      });
    }
    if (details.tipo_alojamiento) {
      items.push({ label: "Tipo", value: details.tipo_alojamiento });
    }
  }

  const cancelKey = normalizeCancelPolicy(details.cancelacion);
  if (CANCEL_LABELS[cancelKey]) {
    items.push({ label: "Cancelación", value: CANCEL_LABELS[cancelKey] });
  }

  if (Array.isArray(details.amenities) && details.amenities.length > 0) {
    const resolved = resolveAmenities(details.amenities);
    items.push({
      label: "Comodidades",
      value: resolved.slice(0, 4).map((a) => a.label).join(", "),
    });
  }

  return items;
}
