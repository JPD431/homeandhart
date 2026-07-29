/**
 * Copy de marketing sobre verificación — debe coincidir con el modelo real:
 * - Todas: identidad (DNI) + mayoría de edad, revisados por el equipo.
 * - Niñeras: + antecedentes penales + delitos de naturaleza sexual.
 * - Mascotas: + antecedentes penales.
 * - Alojamiento: + NRU (licencia turística).
 * Nunca prometer seguridad absoluta ni “bases policiales / tiempo real”.
 */

export const VERIFICADO_BADGE_TOOLTIP_ES =
  "Identidad verificada por nuestro equipo. Según el servicio, también revisamos antecedentes penales (niñeras y mascotas), certificado de delitos sexuales (niñeras) o licencia turística (alojamiento).";

export const VERIFICADO_BADGE_TOOLTIP_EN =
  "Identity reviewed by our team. Depending on the service, we also review criminal record certificates (childcare and pet care), a sexual offences certificate (childcare), or the tourist registration number (accommodation).";

export function getVerificadoBadgeTooltip(lang = "es") {
  return lang === "en"
    ? VERIFICADO_BADGE_TOOLTIP_EN
    : VERIFICADO_BADGE_TOOLTIP_ES;
}

/** Texto intro de confianza (home / trust). */
export const VERIFICACION_HOME_ES =
  "Verificamos la identidad de todos los profesionales. Además, niñeras y cuidadores de mascotas presentan antecedentes penales (las niñeras, también el certificado de delitos sexuales), y los alojamientos su licencia turística. Todo revisado por nuestro equipo antes de publicar.";

export const VERIFICACION_HOME_EN =
  "We verify every professional's identity. In addition, babysitters and pet carers submit criminal record certificates (babysitters also submit a sexual offences certificate), and hosts submit their tourist registration number (NRU). Everything is reviewed by our team before publishing.";

export const VERIFICACION_NINERAS_ES =
  "Antes de activar el perfil de una niñera revisamos su DNI, antecedentes penales, certificado de delitos de naturaleza sexual y confirmamos su mayoría de edad. Es una verificación documental revisada por nuestro equipo, no una garantía de seguridad: usa también tu propio criterio.";

export const VERIFICACION_MASCOTAS_ES =
  "Los cuidadores de mascotas presentan DNI y antecedentes penales, revisados por nuestro equipo antes de activar su perfil.";

export const VERIFICACION_ALOJAMIENTO_ES =
  "Los anfitriones verifican su identidad y aportan el número de registro turístico (NRU) de su alojamiento, que revisamos antes de publicarlo.";
