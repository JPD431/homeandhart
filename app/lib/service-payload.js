import { serializeCapacidad } from "@/app/lib/capacidad";
import { serializeHuespedesPrecioForDb } from "@/app/lib/huespedes-precio";
import {
  getSyncedServicesPrecio,
  legacyModalidadForVertical,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";
import { serializeDescuentosDuracionForDb } from "@/app/lib/descuentosDuracion";
import { parseFotosFromDb, syncServicePhotos } from "@/app/lib/service-photos";

export const DIAS_SEMANA = [
  { id: "lun", label: "Lun" },
  { id: "mar", label: "Mar" },
  { id: "mie", label: "Mié" },
  { id: "jue", label: "Jue" },
  { id: "vie", label: "Vie" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export const DIAS_DISPONIBLES_DEFAULT = DIAS_SEMANA.map((d) => d.id);

export const DEFAULT_NORMAS = {
  petFriendly: false,
  bebes: false,
  fumar: false,
  fiestas: false,
};

const DEFAULT_CHECK_IN = "15:00";
const DEFAULT_CHECK_OUT = "11:00";

export function serializeNormas(details) {
  const n = details?.normas ?? {};
  return {
    petFriendly: n.petFriendly === true,
    bebes: n.bebes === true,
    fumar: n.fumar === true,
    fiestas: n.fiestas === true,
  };
}

export function parseNormasFromDb(row) {
  const raw = row?.normas;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_NORMAS };
  }
  return {
    petFriendly: raw.petFriendly === true,
    bebes: raw.bebes === true,
    fumar: raw.fumar === true,
    fiestas: raw.fiestas === true,
  };
}

export function parseCheckTimesFromDb(row) {
  return {
    check_in: row?.check_in?.trim() || DEFAULT_CHECK_IN,
    check_out: row?.check_out?.trim() || DEFAULT_CHECK_OUT,
  };
}

export function serializeNinosDetalle(details) {
  return {
    edades_tags: Array.isArray(details?.edadesTags) ? [...details.edadesTags] : [],
    formacion_tags: Array.isArray(details?.formacionTags)
      ? [...details.formacionTags]
      : [],
    actividades_tags: Array.isArray(details?.actividadesTags)
      ? [...details.actividadesTags]
      : [],
    noches_finde: details?.nochesFinde === true,
    carnet_conducir: details?.carnetConducir === true,
  };
}

export function parseNinosDetalleFromDb(row) {
  const raw = row?.ninos_detalle;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      edadesTags: [],
      formacionTags: [],
      actividadesTags: [],
      nochesFinde: false,
      carnetConducir: false,
    };
  }
  return {
    edadesTags: Array.isArray(raw.edades_tags) ? [...raw.edades_tags] : [],
    formacionTags: Array.isArray(raw.formacion_tags) ? [...raw.formacion_tags] : [],
    actividadesTags: Array.isArray(raw.actividades_tags)
      ? [...raw.actividades_tags]
      : [],
    nochesFinde: raw.noches_finde === true,
    carnetConducir: raw.carnet_conducir === true,
  };
}

export function serializeMascotasDetalle(details) {
  return {
    animales_tags: Array.isArray(details?.animalesTags) ? [...details.animalesTags] : [],
    tamano_perro: details?.tamanoPerro?.trim() || "",
    certificaciones_tags: Array.isArray(details?.certificacionesTags)
      ? [...details.certificacionesTags]
      : [],
    cerca_veterinario: details?.cercaVeterinario === true,
  };
}

export function parseMascotasDetalleFromDb(row) {
  const raw = row?.mascotas_detalle;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      animalesTags: [],
      tamanoPerro: "",
      certificacionesTags: [],
      cercaVeterinario: false,
    };
  }
  return {
    animalesTags: Array.isArray(raw.animales_tags) ? [...raw.animales_tags] : [],
    tamanoPerro: raw.tamano_perro || "",
    certificacionesTags: Array.isArray(raw.certificaciones_tags)
      ? [...raw.certificaciones_tags]
      : [],
    cercaVeterinario: raw.cerca_veterinario === true,
  };
}

export function parseMascotasBooleansFromDb(row) {
  return {
    jardin: row?.jardin === true,
    paseosIncluidos: row?.paseos_incluidos === true,
    fotosActualizaciones: row?.fotos_actualizaciones === true,
  };
}

/** Filas de plus para ficha de mascotas (anuncio / preview). */
export function getMascotasDisplayRows(service) {
  if (!service || service.vertical !== "mascotas") return [];

  const rows = [];
  if (service.jardin === true) {
    rows.push({ icon: "🌿", label: "Tiene jardín" });
  }
  if (service.paseos_incluidos === true) {
    rows.push({ icon: "🐕", label: "Paseos incluidos" });
  }
  if (service.fotos_actualizaciones === true) {
    rows.push({
      icon: "📷",
      label: "Envía fotos y actualizaciones del cuidado",
    });
  }

  const det = service.mascotas_detalle;
  if (det && typeof det === "object" && det.cerca_veterinario === true) {
    rows.push({ icon: "🏥", label: "Cerca de veterinario" });
  }

  return rows;
}

export function serializeAnosExperiencia(details) {
  const raw = details?.anos_experiencia;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function parseAnosExperienciaFromDb(row) {
  return row?.anos_experiencia != null ? String(row.anos_experiencia) : "";
}

export function needsDireccionFields(vertical, modalidad) {
  if (vertical === "alojamiento") return true;
  if (vertical === "ninos" && modalidad === "domicilio_proveedor") return true;
  if (vertical === "mascotas" && modalidad === "domicilio_proveedor") return true;
  return false;
}

async function geocodificarDireccion(direccion) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(direccion)}.json?access_token=${token}&limit=1`,
  );
  const data = await res.json();
  if (data.features?.[0]) {
    return {
      lat: data.features[0].center[1],
      lng: data.features[0].center[0],
    };
  }
  return null;
}

export async function getServiceLocationFields(details, vertical) {
  // Si no aplica dirección: nulls → syncServiceContact BORRA la fila (regla única).
  if (!needsDireccionFields(vertical, details.modalidad)) {
    return {
      direccion_exacta: null,
      telefono_contacto: null,
      location_lat: null,
      location_lng: null,
    };
  }
  const direccion_exacta = details.direccion_exacta?.trim() || null;
  const telefono_contacto = details.telefono_contacto?.trim() || null;
  let location_lat = null;
  let location_lng = null;
  if (direccion_exacta) {
    const coords = await geocodificarDireccion(direccion_exacta);
    if (coords) {
      location_lat = coords.lat;
      location_lng = coords.lng;
    }
  }
  return { direccion_exacta, telefono_contacto, location_lat, location_lng };
}

export function buildServicePayload(details, vertical, ciudad, proveedorId, disponible) {
  // Paso 1: el suplemento de la modalidad legacy (hora/día) alimenta
  // services.precio_huesped_extra para que la reserva actual no cambie de lógica.
  let detailsForSave = details;
  if (supportsModalidadCobro(vertical)) {
    const legacy = legacyModalidadForVertical(vertical);
    const slot = details?.modalidades_cobro?.[legacy];
    if (slot?.activa) {
      detailsForSave = {
        ...details,
        precio_huesped_extra:
          slot.suplemento_extra != null && slot.suplemento_extra !== ""
            ? slot.suplemento_extra
            : "",
      };
    }
  }

  const syncedPrecio = supportsModalidadCobro(vertical)
    ? getSyncedServicesPrecio(detailsForSave, vertical)
    : null;
  const precio =
    syncedPrecio != null
      ? syncedPrecio
      : detailsForSave.precio
        ? Number(detailsForSave.precio)
        : null;

  const payload = {
    proveedor_id: proveedorId,
    vertical,
    titulo: detailsForSave.titulo.trim(),
    descripcion: detailsForSave.descripcion?.trim() || null,
    precio,
    estancia_minima: details.estancia_minima
      ? Number(details.estancia_minima)
      : null,
    estancia_maxima: details.estancia_maxima
      ? Number(details.estancia_maxima)
      : null,
    antelacion_minima:
      details.antelacion_minima != null && details.antelacion_minima !== ""
        ? Number(details.antelacion_minima)
        : 24,
    dias_disponibles:
      Array.isArray(details.dias_disponibles) &&
      details.dias_disponibles.length > 0
        ? details.dias_disponibles
        : DIAS_DISPONIBLES_DEFAULT,
    cancellation_policy: details.cancelacion,
    ciudad: ciudad.trim(),
    disponible,
    reserva_inmediata: details.reserva_inmediata === true,
    modalidad: vertical === "alojamiento" ? null : details.modalidad || null,
    tipo_alojamiento:
      vertical === "alojamiento" ? details.tipo_alojamiento || null : null,
    nru:
      vertical === "alojamiento" ? details.nru?.trim() || null : null,
    oferta_titulo: details.oferta_activa
      ? details.oferta_titulo?.trim() || null
      : null,
    oferta_descuento:
      details.oferta_activa && details.oferta_descuento
        ? Math.min(90, Math.max(1, Number(details.oferta_descuento)))
        : null,
    oferta_valida_hasta:
      details.oferta_activa && details.oferta_valida_hasta
        ? details.oferta_valida_hasta
        : null,
    oferta_descripcion: details.oferta_activa
      ? details.oferta_descripcion?.trim() || null
      : null,
    disponible_para_viajar:
      (vertical === "ninos" || vertical === "mascotas") &&
      details.disponible_para_viajar === true,
    descuentos_duracion: serializeDescuentosDuracionForDb(details),
    proveedor_emergencia: details.proveedor_emergencia === true,
    amenities: details.amenities || [],
    capacidad: serializeCapacidad(detailsForSave, vertical),
    ...serializeHuespedesPrecioForDb(detailsForSave, vertical),
  };

  syncServicePhotos(
    payload,
    parseFotosFromDb({
      fotos: detailsForSave.fotos,
      foto_url: detailsForSave.foto_url,
    }),
  );

  if (vertical === "alojamiento") {
    payload.normas = serializeNormas(detailsForSave);
    payload.check_in = detailsForSave.check_in?.trim() || null;
    payload.check_out = detailsForSave.check_out?.trim() || null;
  } else if (vertical === "ninos") {
    payload.ninos_detalle = serializeNinosDetalle(detailsForSave);
    payload.anos_experiencia = serializeAnosExperiencia(detailsForSave);
  } else if (vertical === "mascotas") {
    payload.mascotas_detalle = serializeMascotasDetalle(detailsForSave);
    payload.jardin = detailsForSave.jardin === true;
    payload.paseos_incluidos = detailsForSave.paseosIncluidos === true;
    payload.fotos_actualizaciones = detailsForSave.fotosActualizaciones === true;
    payload.anos_experiencia = serializeAnosExperiencia(detailsForSave);
  }

  return payload;
}
