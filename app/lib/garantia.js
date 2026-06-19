export { isCancelacionTardia } from "./is-cancelacion-tardia";

/**
 * @deprecated Usa POST /api/bookings/cancelar-cliente desde el cliente.
 * Wrapper de compatibilidad que delega en el endpoint del servidor.
 */
export async function procesarCancelacionTardia({ bookingId }) {
  const res = await fetch("/api/bookings/cancelar-cliente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "No se pudo cancelar la reserva",
    };
  }

  return {
    ok: true,
    garantia: data.garantia,
    alternativas: data.alternativas ?? [],
  };
}
