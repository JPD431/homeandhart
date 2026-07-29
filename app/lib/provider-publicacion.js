import { REVISION_APROBADO } from "@/app/lib/onboarding-persist";
import { alojamientoNruPublishReady } from "@/app/lib/provider-documents";
import { hasDniUploaded, DNI_REQUIRED_PROVIDER_MSG } from "@/app/lib/dni";
import { needsDireccionFields } from "@/app/lib/service-payload";
import {
  DIRECCION_REQUIRED_PROVIDER_MSG,
  EMAIL_CONTACTO_REQUIRED_PROVIDER_MSG,
  hasEmailContacto,
  hasTelefono,
  TELEFONO_REQUIRED_PROVIDER_MSG,
} from "@/app/lib/profile-telefono";
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

/** Código estable para API/UI cuando la cuenta está en suspensión cautelar. */
export const SUSPENDIDO_CAUTELAR_CODE = "suspendido_cautelar";

export const SUSPENDIDO_CAUTELAR_MSG =
  "Tu cuenta está en revisión por el equipo de seguridad. Contacta con soporte.";

/** Código estable para API/UI cuando falta confirmación de mayoría de edad. */
export const MAYOR_DE_EDAD_PENDIENTE_CODE = "mayor_de_edad_pendiente";

export const MAYOR_DE_EDAD_PENDIENTE_MSG =
  "Debemos confirmar tu mayoría de edad (18+) según tu DNI antes de activar servicios.";

/** Código estable para API/UI cuando falta aprobación de docs de niñera. */
export const NINOS_DOCUMENTACION_PENDIENTE_CODE = "ninos_documentacion_pendiente";

export const NINOS_DOCUMENTACION_PENDIENTE_MSG =
  "Tu documentación de niñera debe ser aprobada por el equipo antes de activar este servicio.";

/** Código estable para API/UI cuando falta aprobación de docs de mascotas. */
export const MASCOTAS_DOCUMENTACION_PENDIENTE_CODE =
  "mascotas_documentacion_pendiente";

export const MASCOTAS_DOCUMENTACION_PENDIENTE_MSG =
  "Tu documentación de mascotas (antecedentes penales) debe ser aprobada por el equipo antes de activar este servicio.";

/** Servicios legacy (revision_estado null) o explícitamente aprobados. */
export function servicioRevisionAprobada(revisionEstado) {
  return revisionEstado == null || revisionEstado === REVISION_APROBADO;
}

/**
 * ¿El servicio puede ponerse disponible automáticamente (approve/webhook)?
 * Respeta suspensión cautelar + revisión + mayoría de edad + docs niñera/mascotas.
 */
export function serviceEligibleForAutoDisponible(service, perfil) {
  if (perfil?.suspendido_cautelar === true) return false;
  if (!servicioRevisionAprobada(service?.revision_estado)) return false;
  if (perfil?.mayor_de_edad_confirmada !== true) return false;
  if (
    service?.vertical === "ninos" &&
    perfil?.ninos_documentacion_aprobada !== true
  ) {
    return false;
  }
  if (
    service?.vertical === "mascotas" &&
    perfil?.mascotas_documentacion_aprobada !== true
  ) {
    return false;
  }
  return true;
}

export function proveedorPuedePublicar(perfil) {
  return (
    perfil?.verificado === true && perfil?.cobros_activos === true
  );
}

/**
 * Modalidad de domicilio del servicio (form details o fila services).
 * @param {{ vertical?: string, modalidad?: string, details?: { modalidad?: string } } | null} service
 */
export function getServiceModalidadDomicilio(service) {
  if (!service) return null;
  return (
    service.details?.modalidad ??
    service.modalidad ??
    null
  );
}

/**
 * Dirección exacta del servicio (form details, fila fusionada o service_contact).
 */
export function getServiceDireccionExacta(service) {
  if (!service) return null;
  const raw =
    service.details?.direccion_exacta ??
    service.direccion_exacta ??
    null;
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || null;
}

/**
 * ¿Este servicio exige dirección para activar? (needsDireccionFields)
 */
export function serviceRequiresDireccionForActivation(service) {
  if (!service?.vertical) return false;
  return needsDireccionFields(
    service.vertical,
    getServiceModalidadDomicilio(service),
  );
}

/**
 * Bloqueos de activación/publicación (orden de prioridad).
 * Suspensión cautelar → DNI → 18+ → verificado → (ninos/mascotas: docs) → cobros / teléfono / email / NRU / dirección.
 *
 * @param {object} perfil
 * @param {{ vertical?: string, modalidad?: string, details?: object, direccion_exacta?: string } | null} [service]
 * @param {import("@/app/lib/provider-documents").DocumentContext} [documentContext]
 * @returns {string[]} mensajes (vacío = puede activar)
 */
export function getServiceActivationBlockers(
  perfil,
  service = null,
  documentContext = null,
) {
  const blockers = [];
  const accountEmail = documentContext?.accountEmail ?? null;

  if (perfil?.suspendido_cautelar === true) {
    blockers.push(SUSPENDIDO_CAUTELAR_MSG);
  }
  if (!hasDniUploaded(perfil)) {
    blockers.push(DNI_REQUIRED_PROVIDER_MSG);
  }
  if (perfil?.mayor_de_edad_confirmada !== true) {
    blockers.push(MAYOR_DE_EDAD_PENDIENTE_MSG);
  }
  if (perfil?.verificado !== true) {
    blockers.push(REVISION_PENDIENTE_MSG);
  }
  if (
    service?.vertical === "ninos" &&
    perfil?.ninos_documentacion_aprobada !== true
  ) {
    blockers.push(NINOS_DOCUMENTACION_PENDIENTE_MSG);
  }
  if (
    service?.vertical === "mascotas" &&
    perfil?.mascotas_documentacion_aprobada !== true
  ) {
    blockers.push(MASCOTAS_DOCUMENTACION_PENDIENTE_MSG);
  }
  if (perfil?.cobros_activos !== true) {
    blockers.push(COBROS_REQUERIDOS_MSG);
  }
  if (!hasTelefono(perfil)) {
    blockers.push(TELEFONO_REQUIRED_PROVIDER_MSG);
  }
  // Email de cuenta (login) vale como email_contacto — no bloquear si ya lo tenemos.
  if (!hasEmailContacto(perfil, accountEmail)) {
    blockers.push(EMAIL_CONTACTO_REQUIRED_PROVIDER_MSG);
  }
  if (
    service?.vertical === "alojamiento" &&
    documentContext &&
    !alojamientoNruPublishReady(documentContext)
  ) {
    blockers.push(NRU_PDF_REQUERIDO_MSG);
  }
  if (
    service &&
    serviceRequiresDireccionForActivation(service) &&
    !getServiceDireccionExacta(service)
  ) {
    blockers.push(DIRECCION_REQUIRED_PROVIDER_MSG);
  }

  return blockers;
}

/**
 * Primer blocker con código (para APIs).
 * @returns {{ code: string, message: string } | null}
 */
export function getFirstActivationBlocker(
  perfil,
  service = null,
  documentContext = null,
) {
  const blockers = getServiceActivationBlockers(
    perfil,
    service,
    documentContext,
  );
  if (blockers.length === 0) return null;
  const message = blockers[0];
  let code = "activation_blocked";
  if (message === SUSPENDIDO_CAUTELAR_MSG) {
    code = SUSPENDIDO_CAUTELAR_CODE;
  } else if (message === MAYOR_DE_EDAD_PENDIENTE_MSG) {
    code = MAYOR_DE_EDAD_PENDIENTE_CODE;
  } else if (message === NINOS_DOCUMENTACION_PENDIENTE_MSG) {
    code = NINOS_DOCUMENTACION_PENDIENTE_CODE;
  } else if (message === MASCOTAS_DOCUMENTACION_PENDIENTE_MSG) {
    code = MASCOTAS_DOCUMENTACION_PENDIENTE_CODE;
  }
  return { code, message };
}

/**
 * ¿Puede activarse este servicio ahora?
 * @param {{ vertical?: string, details?: object }} service
 * @param {object} perfil
 * @param {import("@/app/lib/provider-documents").DocumentContext} [documentContext]
 */
export function puedeActivarServicio(service, perfil, documentContext = {}) {
  return getServiceActivationBlockers(perfil, service, documentContext)
    .length === 0;
}

/**
 * Primer mensaje de bloqueo (compat UI / API).
 * @param {object} perfil
 * @param {{ vertical?: string }} [service]
 * @param {import("@/app/lib/provider-documents").DocumentContext} [documentContext]
 */
export function getActivacionBloqueoMensaje(
  perfil,
  service = null,
  documentContext = null,
) {
  const blockers = getServiceActivationBlockers(
    perfil,
    service,
    documentContext,
  );
  return blockers[0] ?? null;
}

/**
 * ¿Faltan datos de contacto del proveedor para el banner suave?
 * Email de cuenta cuenta como email_contacto.
 * @param {object|null|undefined} perfil
 * @param {string | null | undefined} [accountEmail]
 */
export function providerMissingContactBanner(perfil, accountEmail = null) {
  if (!perfil) return false;
  return !hasTelefono(perfil) || !hasEmailContacto(perfil, accountEmail);
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

  if (perfil?.suspendido_cautelar === true) {
    return {
      label: "Cuenta en revisión de seguridad",
      subtitle: SUSPENDIDO_CAUTELAR_MSG,
      color: "#b91c1c",
    };
  }

  if (perfil?.mayor_de_edad_confirmada !== true) {
    return {
      label: "Mayoría de edad pendiente",
      subtitle: MAYOR_DE_EDAD_PENDIENTE_MSG,
      color: "#c47d1a",
    };
  }

  if (perfil?.verificado !== true) {
    return {
      label: "En revisión",
      subtitle: "Pendiente de aprobación del equipo",
      color: "#c47d1a",
    };
  }

  if (
    service?.vertical === "ninos" &&
    perfil?.ninos_documentacion_aprobada !== true
  ) {
    return {
      label: "Documentación de niñera pendiente",
      subtitle: NINOS_DOCUMENTACION_PENDIENTE_MSG,
      color: "#c47d1a",
    };
  }

  if (
    service?.vertical === "mascotas" &&
    perfil?.mascotas_documentacion_aprobada !== true
  ) {
    return {
      label: "Documentación de mascotas pendiente",
      subtitle: MASCOTAS_DOCUMENTACION_PENDIENTE_MSG,
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

  // Ya activo: no degradar a “falta teléfono” (grandfathering visual).
  return {
    label: "Servicio activo",
    subtitle: "Visible en búsqueda",
    color: "#0e7a5c",
  };
}

/**
 * Disponible efectivo al guardar: no desactiva legacy ya activo; bloquea activaciones nuevas sin requisitos.
 * Sin grandfathering si suspensión cautelar, falta mayoría de edad, o docs niñera/mascotas.
 * @param {{ disponible?: boolean, disponibleOnLoad?: boolean, vertical?: string, details?: object }} service
 */
export function resolveDisponibleForSave(service, perfil, documentContext) {
  if (!service.disponible) return false;

  if (perfil?.suspendido_cautelar === true) {
    return false;
  }

  if (perfil?.mayor_de_edad_confirmada !== true) {
    return false;
  }

  if (
    service.vertical === "ninos" &&
    perfil?.ninos_documentacion_aprobada !== true
  ) {
    return false;
  }

  if (
    service.vertical === "mascotas" &&
    perfil?.mascotas_documentacion_aprobada !== true
  ) {
    return false;
  }

  // Grandfathering: ya estaba activo → no forzar pausa por datos nuevos (otras verticales).
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
