import "server-only";

import { sendPlatformEmail } from "@/app/lib/send-platform-email";

/** Notifica por email una incidencia de reserva (solo server). */
export async function enviarEmailIncidenciaReserva(_baseUrl, payload) {
  try {
    const result = await sendPlatformEmail({
      tipo: "incidencia_reserva",
      ...payload,
    });
    if (!result.ok) {
      console.error(
        "[incidencia_reserva] FALLO email",
        `status=${result.status ?? "?"}`,
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[incidencia_reserva] EXCEPCIÓN email", err);
  }
}
