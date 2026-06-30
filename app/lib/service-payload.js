import { serializeCapacidad } from "@/app/lib/capacidad";
import { serializeDescuentosDuracionForDb } from "@/app/lib/descuentosDuracion";

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
  return {
    proveedor_id: proveedorId,
    vertical,
    titulo: details.titulo.trim(),
    descripcion: details.descripcion?.trim() || null,
    precio: details.precio ? Number(details.precio) : null,
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
      details.oferta_activa &&
      (vertical === "ninos" || vertical === "mascotas") &&
      details.disponible_para_viajar === true,
    descuentos_duracion: serializeDescuentosDuracionForDb(details),
    proveedor_emergencia: details.proveedor_emergencia === true,
    amenities: details.amenities || [],
    foto_url: details.foto_url || null,
    capacidad: serializeCapacidad(details, vertical),
  };
}
