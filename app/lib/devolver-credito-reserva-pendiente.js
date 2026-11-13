import {
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

/**
 * Misma clave para rechazo manual y caducidad por cron: un solo abono aunque
 * ambos caminos se reintenten.
 */
export function creditIdempotencyKeyRejectOrExpire(bookingId) {
  return `credit:reject-or-expire:${bookingId}`;
}

/**
 * Devuelve al cliente el credito_aplicado de una reserva pendiente que se
 * rechaza o caduca. Idempotente vía RPC credit_credito_disponible.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{
 *   id: string,
 *   cliente_id?: string | null,
 *   credito_aplicado?: number | string | null,
 *   precio_total?: number | string | null,
 * }} booking
 * @param {string} [logPrefix]
 * @returns {Promise<{ credito_devuelto: number, skipped: boolean, reason?: string }>}
 */
export async function devolverCreditoReservaPendiente(
  supabaseAdmin,
  booking,
  logPrefix = "[credito-reject-or-expire]",
) {
  const credito = roundMoney(Number(booking?.credito_aplicado) || 0);
  if (!booking?.id || !booking?.cliente_id || !(credito > 0)) {
    return { credito_devuelto: 0, skipped: true, reason: "sin_credito" };
  }

  const abonado = await devolverCreditoCliente(
    supabaseAdmin,
    booking.cliente_id,
    credito,
    logPrefix,
    { idempotencyKey: creditIdempotencyKeyRejectOrExpire(booking.id) },
  );

  // Auditoría en la fila (best-effort; no bloquea si falla).
  try {
    const precioTotal = roundMoney(Number(booking.precio_total) || 0);
    await supabaseAdmin
      .from("bookings")
      .update({
        reembolso_cliente_pct: 100,
        reembolso_cliente_total: precioTotal,
        reembolso_cliente_credito: credito,
      })
      .eq("id", booking.id)
      .is("reembolso_cliente_credito", null);
  } catch (err) {
    console.error(
      `${logPrefix} No se pudo guardar reembolso_cliente_credito:`,
      err?.message ?? err,
      { bookingId: booking.id },
    );
  }

  return {
    credito_devuelto: abonado,
    skipped: false,
  };
}
