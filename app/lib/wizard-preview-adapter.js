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

  items.push({
    label: "Precio",
    value: formatServiceCardPrice(details.precio, theme.priceSuffix),
  });

  if (vertical === "alojamiento") {
    const capRows = getCapacidadDisplayRows({ capacidad: details.capacidad });
    if (capRows.length > 0) {
      items.push({
        label: "Capacidad",
        value: capRows
          .map((row) => formatCapacidadDisplayRow(row))
          .join(" · "),
      });
    }

    const amenityLabels = resolveAmenities(details.amenities).map((a) => a.label);
    if (amenityLabels.length > 0) {
      items.push({
        label: "Comodidades",
        value: amenityLabels.slice(0, 4).join(", ") + (amenityLabels.length > 4 ? "…" : ""),
      });
    }
  }

  const cancelKey = normalizeCancelPolicy(details.cancelacion || "moderada");
  items.push({
    label: "Cancelación",
    value: CANCEL_LABELS[cancelKey] || cancelKey,
  });

  items.push({
    label: "Tipo de reserva",
    value: details.reserva_inmediata ? "Reserva inmediata" : "Con confirmación",
  });

  return items;
}
