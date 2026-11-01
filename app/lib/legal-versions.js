/**
 * Versiones vigentes de documentos legales (RGPD / evidencia de consentimiento).
 *
 * TODO(LEGAL) — IMPORTANTE ANTES DE PUBLICAR: los textos de /legal/terminos,
 * /legal/privacidad, /legal/aviso y /legal/cookies son marcadores de posición.
 * Deben ser redactados y revisados por un abogado. Al publicar los textos
 * definitivos, cambia SOLO LEGAL_DOCS_VERSION (ej. "2026-08"): las páginas
 * legales, el registro, el aviso de cookies y el ConsentGate la leen de aquí.
 * Los usuarios con versión distinta deberán reaceptar (ConsentGate).
 */
export const LEGAL_DOCS_VERSION = "2026-07";

export const TERMS_VERSION = LEGAL_DOCS_VERSION;
export const PRIVACY_VERSION = LEGAL_DOCS_VERSION;

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "Última actualización: julio 2026 · v. 2026-07" a partir de LEGAL_DOCS_VERSION. */
export function legalUpdatedLabel(version = LEGAL_DOCS_VERSION) {
  const [year, month] = version.split("-");
  const mes = MESES_ES[Number(month) - 1];
  const fecha = mes ? `${mes} ${year}` : version;
  return `Última actualización: ${fecha} · v. ${version}`;
}

export const LEGAL_DOC_PATHS = {
  terminos: "/legal/terminos",
  privacidad: "/legal/privacidad",
};
