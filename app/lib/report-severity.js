/**
 * Catálogo de motivos de reporte y gravedad (seguridad infantil / confianza).
 * Los strings deben coincidir exactamente con lo que guardamos en reports.motivo.
 */

/** Motivos que disparan suspensión cautelar automática (si el reportado es proveedor). */
export const MOTIVOS_GRAVES = Object.freeze([
  "Comportamiento inapropiado",
  "Contenido ofensivo",
  "Perfil suplantado",
  "Riesgo o seguridad del menor",
  "Abuso, acoso o conducta sexual inapropiada",
]);

/** Motivos operativos / leves (sin auto-suspensión). */
export const MOTIVOS_LEVES = Object.freeze([
  "Información falsa o engañosa",
  "No se presentó al servicio",
  "Servicio no cumplió lo acordado",
  "Problema con el alojamiento o instalaciones",
  "Problema con el pago o cobro",
]);

/** Ambiguo: admin clasifica; nunca dispara auto-suspensión. */
export const MOTIVO_OTRO = "Otro";

const GRAVES_SET = new Set(MOTIVOS_GRAVES);

/**
 * ¿El motivo está catalogado como grave?
 * "Otro" y motivos desconocidos → false (no auto-suspender).
 * @param {string | null | undefined} motivo
 * @returns {boolean}
 */
export function isMotivoGrave(motivo) {
  if (typeof motivo !== "string") return false;
  return GRAVES_SET.has(motivo.trim());
}

/**
 * Motivos del modal "Reportar perfil" (orden UI).
 * Graves de seguridad primero; luego leves aplicables; Otro al final.
 */
export const MOTIVOS_REPORTE_PERFIL = Object.freeze([
  "Riesgo o seguridad del menor",
  "Abuso, acoso o conducta sexual inapropiada",
  "Comportamiento inapropiado",
  "Contenido ofensivo",
  "Perfil suplantado",
  "Información falsa o engañosa",
  "No se presentó al servicio",
  MOTIVO_OTRO,
]);

/**
 * Motivos del formulario de incidencia de reserva (orden UI).
 */
export const MOTIVOS_INCIDENCIA_RESERVA = Object.freeze([
  "Riesgo o seguridad del menor",
  "Abuso, acoso o conducta sexual inapropiada",
  "Comportamiento inapropiado",
  "Servicio no cumplió lo acordado",
  "No se presentó al servicio",
  "Problema con el alojamiento o instalaciones",
  "Problema con el pago o cobro",
  MOTIVO_OTRO,
]);

/** Valor de profiles.suspendido_cautelar_por cuando lo dispara el sistema. */
export const SUSPENSION_CAUTELAR_POR_SISTEMA = "sistema";
