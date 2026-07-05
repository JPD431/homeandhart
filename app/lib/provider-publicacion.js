import { REVISION_APROBADO } from "@/app/lib/onboarding-persist";
import { alojamientoNruPublishReady } from "@/app/lib/provider-documents";
import {
  buildAnuncioHref,
  buildAnuncioPreviewHref,
} from "@/app/lib/service-card-display";

export const COBROS_REQUERIDOS_MSG =
  "Configura tus cobros antes de activar un servicio. Ve a tu panel de proveedor y pulsa «Configurar cobros».";

export const REVISION_PENDIENTE_MSG =
  "Tus servicios están en revisión. Te avisaremos por email cuando los aprobemos.";

export const NRU_PDF_REQUERIDO_MSG =
  "Para publicar tu alojamiento, sube el PDF de la resolución del NRU en tus documentos.";

/** Servicios legacy (revision_estado null) o explícitamente aprobados. */
export function servicioRevisionAprobada(revisionEstado) {
  return revisionEstado == null || revisionEstado === REVISION_APROBADO;
}

export function proveedorPuedePublicar(perfil) {
  return (
    perfil?.verificado === true && perfil?.cobros_activos === true
  );
}

/**
 * ¿Puede activarse este servicio ahora? (verificado + cobros; alojamiento además NRU texto + PDF)
 * @param {{ vertical?: string, details?: { nru?: string } }} service
 * @param {object} perfil
 * @param {import("@/app/lib/provider-documents").DocumentContext} [documentContext]
 */
export function puedeActivarServicio(service, perfil, documentContext = {}) {
  if (!proveedorPuedePublicar(perfil)) return false;
  if (service?.vertical === "alojamiento") {
    return alojamientoNruPublishReady(documentContext);
  }
  return true;
}

/**
 * Mensaje al bloquear activación; prioriza revisión → cobros → PDF NRU (alojamiento).
 * @param {object} perfil
 * @param {{ vertical?: string }} [service]
 * @param {import("@/app/lib/provider-documents").DocumentContext} [documentContext]
 */
export function getActivacionBloqueoMensaje(perfil, service = null, documentContext = null) {
  if (perfil?.verificado !== true) {
    return REVISION_PENDIENTE_MSG;
  }
  if (perfil?.cobros_activos !== true) {
    return COBROS_REQUERIDOS_MSG;
  }
  if (
    service?.vertical === "alojamiento" &&
    documentContext &&
    !alojamientoNruPublishReady(documentContext)
  ) {
    return NRU_PDF_REQUERIDO_MSG;
  }
  return null;
}

/**
 * @param {object} perfil
 * @param {boolean} disponible
 * @param {{ service?: { vertical?: string }, documentContext?: import("@/app/lib/provider-documents").DocumentContext }} [options]
 */
export function getServiceVisibilidadEstado(perfil, disponible, options = {}) {
  const { service, documentContext } = options;

  if (!disponible) {
    return {
      label: "Servicio en pausa",
      subtitle: "No visible para clientes",
      color: "#666",
    };
  }

  if (perfil?.verificado !== true) {
    return {
      label: "En revisión",
      subtitle: "Pendiente de aprobación del equipo",
      color: "#c47d1a",
    };
  }

  if (perfil?.cobros_activos !== true) {
    return {
      label: "Falta configurar cobros",
      subtitle: "Configura tus cobros para publicar en búsqueda",
      color: "#c47d1a",
    };
  }

  if (
    service?.vertical === "alojamiento" &&
    documentContext &&
    !alojamientoNruPublishReady(documentContext)
  ) {
    return {
      label: "Falta resolución NRU",
      subtitle: "Sube el PDF de la resolución del NRU en Documentos",
      color: "#c47d1a",
    };
  }

  return {
    label: "Servicio activo",
    subtitle: "Visible en búsqueda",
    color: "#0e7a5c",
  };
}

/**
 * Disponible efectivo al guardar: no desactiva legacy ya activo; bloquea activaciones nuevas sin requisitos.
 * @param {{ disponible?: boolean, disponibleOnLoad?: boolean, vertical?: string, details?: object }} service
 */
export function resolveDisponibleForSave(service, perfil, documentContext) {
  if (!service.disponible) return false;
  if (service.disponibleOnLoad === true) return true;
  return puedeActivarServicio(service, perfil, documentContext);
}

/** URL del anuncio para el proveedor: pública si ya es visible, preview si no. */
export function getProviderAnuncioHref(service, perfil, documentContext = null) {
  if (!service?.id) return buildAnuncioPreviewHref("unknown");

  const publiclyVisible =
    service.disponible === true &&
    servicioRevisionAprobada(service.revision_estado) &&
    getServiceVisibilidadEstado(perfil, true, { service, documentContext }).label ===
      "Servicio activo";

  return publiclyVisible
    ? buildAnuncioHref(service.id)
    : buildAnuncioPreviewHref(service.id);
}
