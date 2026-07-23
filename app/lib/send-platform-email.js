import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";

/**
 * Envía un email de plataforma desde código server-side.
 * Llama DIRECTAMENTE a dispatchPlatformEmail (sin fetch HTTP, sin Bearer,
 * sin NEXT_PUBLIC_URL ni CRON_SECRET).
 *
 * @param {Record<string, unknown>} payload — { tipo, ...campos }
 * @returns {Promise<{ ok: boolean, status: number, data?: object, error?: string }>}
 */
export async function sendPlatformEmail(payload) {
  const tipo =
    typeof payload?.tipo === "string" ? payload.tipo : "(sin tipo)";

  try {
    const result = await dispatchPlatformEmail(payload);

    if (!result.ok) {
      console.error(
        "[sendPlatformEmail] FALLO",
        `tipo=${tipo}`,
        `status=${result.status ?? "?"}`,
        result.error || "Error desconocido",
      );
    }

    return result;
  } catch (err) {
    console.error(
      "[sendPlatformEmail] EXCEPCIÓN",
      `tipo=${tipo}`,
      err?.message || err,
    );
    return {
      ok: false,
      status: 500,
      error: err?.message || "Error al enviar email",
    };
  }
}
