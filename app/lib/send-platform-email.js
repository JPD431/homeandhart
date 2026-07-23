import {
  getAppBaseUrl,
  getInternalApiSecret,
  internalApiHeaders,
} from "@/app/lib/internal-api-auth";

/**
 * Envía un email de plataforma vía POST /api/emails (solo server-side).
 * Añade el secreto interno; nunca llamar desde el navegador.
 *
 * @param {Record<string, unknown>} payload — { tipo, ...campos }
 * @returns {Promise<{ ok: boolean, status: number, data?: object, error?: string }>}
 */
export async function sendPlatformEmail(payload) {
  if (!getInternalApiSecret()) {
    console.error("[sendPlatformEmail] CRON_SECRET no configurado");
    return {
      ok: false,
      status: 500,
      error: "CRON_SECRET no está configurado",
    };
  }

  const baseUrl = getAppBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: internalApiHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || `Email failed: ${res.status}`,
        data,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    console.error("[sendPlatformEmail]", err);
    return {
      ok: false,
      status: 500,
      error: err?.message || "Error al enviar email",
    };
  }
}
