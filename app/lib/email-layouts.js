/** Plantillas HTML compartidas de emails (cabecera + layouts). */

export const BRAND_PRIMARY = "#1d4f91";
export const BRAND_LIGHT = "#e8f0fb";
export const BRAND_DARK = "#163a6b";
export const BRAND_GREEN = "#0e7a5c";
export const BRAND_WARM = "#f7f5f2";
export const BRAND_BORDER = "#e8e4de";

export const BASE_URL =
  process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

const EMAIL_LOGO_URL = `${BASE_URL}/email-logo.png`;
const EMAIL_LOGO_LIGHT_URL = `${BASE_URL}/email-logo-light.png`;
const EMAIL_LOGO_HEIGHT = 56;

/**
 * Cabecera de marca: icono + wordmark tipográfico debajo.
 * Marketing (fondo azul) → logo claro; transaccional (fondo blanco) → logo azul.
 * @param {"marketing" | "transactional"} variant
 */
export function brandHeaderHtml(variant = "transactional") {
  const isMarketing = variant === "marketing";
  const logoUrl = isMarketing ? EMAIL_LOGO_LIGHT_URL : EMAIL_LOGO_URL;
  const wordmark = isMarketing
    ? `<p style="margin:10px 0 0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">
        Home<span style="font-style:italic;">&amp;</span>Heart
      </p>`
    : `<p style="margin:10px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;">
        <span style="color:#111111;">Home</span><span style="color:${BRAND_PRIMARY};font-style:italic;">&amp;</span><span style="color:#111111;">Heart</span>
      </p>`;

  return `<a href="${BASE_URL}" style="text-decoration:none;color:inherit;display:inline-block;">
      <img
        src="${logoUrl}"
        alt="Home&amp;Heart"
        height="${EMAIL_LOGO_HEIGHT}"
        style="height:${EMAIL_LOGO_HEIGHT}px;width:auto;max-width:80px;display:block;margin:0 auto;border:0;outline:none;"
      />
      ${wordmark}
    </a>`;
}

export function marketingFooter() {
  return `<div style="margin-top:32px;padding-top:20px;border-top:1px solid ${BRAND_BORDER};text-align:center;">
    <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">
      <a href="${BASE_URL}/legal/privacidad" style="color:#999;text-decoration:none;">Privacidad</a> ·
      <a href="${BASE_URL}/legal/terminos" style="color:#999;text-decoration:none;">Términos</a> ·
      <a href="${BASE_URL}/legal/cookies" style="color:#999;text-decoration:none;">Cookies</a>
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#bbb;">
      <a href="${BASE_URL}/editar-perfil" style="color:#bbb;text-decoration:none;">Darse de baja</a>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;">Home&amp;Heart · Donde estés, estamos.</p>
  </div>`;
}

export function marketingEmailLayout({ title, headerHtml, bodyHtml, headerBg }) {
  const headerStyle =
    headerBg ||
    `background:linear-gradient(160deg, ${BRAND_PRIMARY} 0%, ${BRAND_DARK} 100%);`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_WARM};font-family:Georgia,'Times New Roman',Times,serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND_WARM};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid ${BRAND_BORDER};overflow:hidden;">
          <tr>
            <td style="${headerStyle}padding:28px 32px;text-align:center;">
              ${brandHeaderHtml("marketing")}
              ${headerHtml || ""}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
              ${marketingFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailLayout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f5f2;font-family:Georgia,'Times New Roman',Times,serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f5f2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e8e4de;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              ${brandHeaderHtml("transactional")}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              ${bodyHtml}
              <p style="margin:28px 0 0;font-size:13px;color:#666;line-height:1.5;">
                El equipo de Home&amp;Heart · Donde estés, estamos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * HTML de ejemplo para previsualizar cabeceras sin enviar.
 * @param {"marketing" | "transaccional" | "transactional"} tipo
 */
export function previewEmailHtml(tipo) {
  const key = String(tipo || "").toLowerCase();

  if (key === "marketing") {
    return marketingEmailLayout({
      title: "Vista previa · Marketing — Home&Heart",
      headerHtml: `<p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Vista previa (marketing)</p>`,
      bodyHtml: `
        <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">Cabecera marketing</h1>
        <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
          Este es un email de ejemplo. Revisa el logo sobre el fondo azul de la cabecera.
          Logo: <code style="font-size:12px;">${EMAIL_LOGO_LIGHT_URL}</code>
        </p>`,
    });
  }

  if (key === "transaccional" || key === "transactional") {
    return emailLayout({
      title: "Vista previa · Transaccional — Home&Heart",
      bodyHtml: `
        <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Cabecera transaccional</h1>
        <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
          Este es un email de ejemplo. Revisa el logo sobre el fondo blanco.
          Logo: <code style="font-size:12px;">${EMAIL_LOGO_URL}</code>
        </p>`,
    });
  }

  return null;
}
