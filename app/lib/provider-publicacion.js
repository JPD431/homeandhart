import { REVISION_APROBADO } from "@/app/lib/onboarding-persist";
import {
  buildAnuncioHref,
  buildAnuncioPreviewHref,
} from "@/app/lib/service-card-display";

export const COBROS_REQUERIDOS_MSG =
  "Configura tus cobros antes de activar un servicio. Ve a tu panel de proveedor y pulsa «Configurar cobros».";

export const REVISION_PENDIENTE_MSG =
  "Tus servicios están en revisión. Te avisaremos por email cuando los aprobemos.";

/** Servicios legacy (revision_estado null) o explícitamente aprobados. */
export function servicioRevisionAprobada(revisionEstado) {
  return revisionEstado == null || revisionEstado === REVISION_APROBADO;
}

export function proveedorPuedePublicar(perfil) {
  return (
    perfil?.verificado === true && perfil?.cobros_activos === true
  );
}

/** Mensaje al bloquear activación; prioriza revisión sobre cobros. */
export function getActivacionBloqueoMensaje(perfil) {
  if (perfil?.verificado !== true) {
    return REVISION_PENDIENTE_MSG;
  }
  if (perfil?.cobros_activos !== true) {
    return COBROS_REQUERIDOS_MSG;
  }
  return null;
}

export function getServiceVisibilidadEstado(perfil, disponible) {
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

  return {
    label: "Servicio activo",
    subtitle: "Visible en búsqueda",
    color: "#0e7a5c",
  };
}

/** URL del anuncio para el proveedor: pública si ya es visible, preview si no. */
export function getProviderAnuncioHref(service, perfil) {
  if (!service?.id) return buildAnuncioPreviewHref("unknown");

  const publiclyVisible =
    service.disponible === true &&
    servicioRevisionAprobada(service.revision_estado) &&
    getServiceVisibilidadEstado(perfil, true).label === "Servicio activo";

  return publiclyVisible
    ? buildAnuncioHref(service.id)
    : buildAnuncioPreviewHref(service.id);
}
