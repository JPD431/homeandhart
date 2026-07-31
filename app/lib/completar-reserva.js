import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { createNotification } from "@/app/lib/notifications";
import { rewardReferidorPrimeraReserva } from "@/app/lib/referidos";

/** Estados desde los que se puede completar. */
export const COMPLETABLE_STATES = ["confirmada", "en_curso"];

/** Horas tras el fin efectivo antes del auto-complete del cron (Vía 2). */
export const CRON_COMPLETE_AFTER_HOURS = 72;

/**
 * Fin efectivo del servicio: fecha_fin, o fecha_inicio si no hay fecha_fin (niñera).
 * @param {{ fecha_fin?: string | null, fecha_inicio?: string | null }} booking
 * @returns {string | null} YYYY-MM-DD
 */
export function getBookingEffectiveEndDate(booking) {
  const fin =
    typeof booking?.fecha_fin === "string" && booking.fecha_fin.trim()
      ? booking.fecha_fin.trim().slice(0, 10)
      : null;
  if (fin) return fin;
  const inicio =
    typeof booking?.fecha_inicio === "string" && booking.fecha_inicio.trim()
      ? booking.fecha_inicio.trim().slice(0, 10)
      : null;
  return inicio || null;
}

/**
 * Instantánea UTC en la que el fin efectivo + `hours` ya ha pasado.
 * Usa medianoche UTC del día de fin + hours (coherente con el cron por fechas).
 */
export function effectiveEndElapsedAfterHours(booking, hours) {
  const end = getBookingEffectiveEndDate(booking);
  if (!end) return false;
  const startMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs)) return false;
  return Date.now() >= startMs + hours * 60 * 60 * 1000;
}

/**
 * Completa una reserva y libera el pago UNA sola vez (F2: claim pago_liberado_at).
 * Idempotente: si ya está completada y pagada → ok sin rehacer.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} bookingId
 * @param {{
 *   source?: "cliente" | "email" | "cron" | "admin",
 *   liberarPago?: boolean,
 *   notifyReview?: boolean,
 * }} [opts]
 */
export async function completarReservaYLiberarPago(
  supabaseAdmin,
  bookingId,
  opts = {},
) {
  const source = opts.source || "unknown";
  const liberarPago = opts.liberarPago !== false;
  const notifyReview = opts.notifyReview !== false;
  const logPrefix = `[completar-reserva:${source}]`;

  if (!bookingId) {
    return { ok: false, status: 400, error: "Falta bookingId" };
  }

  const { data: booking, error: loadError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      cliente_id,
      service_id,
      estado,
      payment_intent_id,
      pago_liberado_at,
      completada_at,
      confirmacion_cliente,
      fecha_inicio,
      fecha_fin,
      services:service_id ( titulo )
    `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, status: 500, error: loadError.message };
  }
  if (!booking) {
    return { ok: false, status: 404, error: "Reserva no encontrada" };
  }

  const terminalBlocked = new Set([
    "cancelada",
    "cancelada_proveedor",
    "cancelada_garantia",
    "rechazada",
    "incidencia",
    "incidencia_resuelta",
  ]);

  if (terminalBlocked.has(booking.estado)) {
    return {
      ok: false,
      status: 400,
      error: `No se puede completar una reserva en estado «${booking.estado}».`,
    };
  }

  let justCompleted = false;
  let current = booking;

  if (COMPLETABLE_STATES.includes(booking.estado)) {
    const ahora = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "completada",
        completada_at: ahora,
      })
      .eq("id", bookingId)
      .in("estado", COMPLETABLE_STATES)
      .select(
        "id, cliente_id, service_id, estado, payment_intent_id, pago_liberado_at, completada_at, confirmacion_cliente",
      )
      .maybeSingle();

    if (claimError) {
      return { ok: false, status: 500, error: claimError.message };
    }

    if (claimed) {
      justCompleted = true;
      current = { ...booking, ...claimed };
    } else {
      const { data: again } = await supabaseAdmin
        .from("bookings")
        .select(
          "id, cliente_id, service_id, estado, payment_intent_id, pago_liberado_at, completada_at, confirmacion_cliente",
        )
        .eq("id", bookingId)
        .maybeSingle();

      if (!again || again.estado !== "completada") {
        return {
          ok: false,
          status: 409,
          error: "No se pudo completar la reserva (estado cambió).",
        };
      }
      current = { ...booking, ...again };
    }
  } else if (booking.estado !== "completada") {
    return {
      ok: false,
      status: 400,
      error: `Estado «${booking.estado}» no permite completar.`,
    };
  }

  if (justCompleted) {
    try {
      await rewardReferidorPrimeraReserva(current.cliente_id, supabaseAdmin, {
        bookingId: current.id,
      });
    } catch (refErr) {
      console.error(
        logPrefix,
        "rewardReferidorPrimeraReserva",
        current.id,
        refErr?.message ?? refErr,
      );
    }

    if (notifyReview && current.cliente_id) {
      try {
        const servicioTitulo =
          booking.services?.titulo?.trim() || "tu servicio";
        await createNotification(null, {
          user_id: current.cliente_id,
          tipo: "deja_resena",
          titulo: "¿Cómo fue tu servicio?",
          mensaje: `Cuéntanos cómo fue ${servicioTitulo} y ayuda a otras familias.`,
          href: `/resena/${current.id}`,
          entity_type: "booking",
          entity_id: current.id,
        });
      } catch (notifErr) {
        console.error(
          logPrefix,
          "notificación deja_resena",
          current.id,
          notifErr?.message ?? notifErr,
        );
      }
    }
  }

  let capture = {
    success: true,
    skipped: true,
    already_processed: Boolean(current.pago_liberado_at),
  };

  if (liberarPago) {
    if (current.pago_liberado_at) {
      capture = { success: true, already_processed: true };
    } else if (!current.payment_intent_id) {
      // Reserva sin PI (p.ej. 100% crédito): nada que capturar.
      capture = { success: true, no_payment: true };
    } else {
      capture = await capturarYTransferirPago(
        supabaseAdmin,
        current.payment_intent_id,
        { logPrefix },
      );

      if (!capture?.success && !capture?.already_processed) {
        return {
          ok: false,
          status:
            capture?.error_code === "pi_not_capturable" ||
            capture?.error_code === "pi_canceled"
              ? 409
              : 500,
          error: capture?.error || "No se pudo liberar el pago",
          completed: justCompleted || current.estado === "completada",
          already_completed: !justCompleted,
          capture,
        };
      }
    }

    // Solo marcar ok tras liberación exitosa / ya liberada / sin PI.
    // Evita el bug de ok prematuro que bloqueaba reintentos del cron.
    if (current.confirmacion_cliente !== "problema") {
      const ahora = new Date().toISOString();
      const { error: okError } = await supabaseAdmin
        .from("bookings")
        .update({
          confirmacion_cliente: "ok",
          confirmado_at: ahora,
        })
        .eq("id", current.id)
        .neq("confirmacion_cliente", "problema");

      if (okError) {
        console.error(logPrefix, "Error marcando confirmacion_cliente=ok", {
          bookingId: current.id,
          message: okError.message,
        });
      }
    }
  }

  return {
    ok: true,
    status: 200,
    completed: justCompleted,
    already_completed: !justCompleted,
    already_paid: Boolean(current.pago_liberado_at) || Boolean(capture?.already_processed),
    capture,
    booking_id: current.id,
  };
}
