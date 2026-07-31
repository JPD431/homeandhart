import { createClient } from "@supabase/supabase-js";
import {
  completarReservaYLiberarPago,
  CRON_COMPLETE_AFTER_HOURS,
  effectiveEndElapsedAfterHours,
  getBookingEffectiveEndDate,
} from "@/app/lib/completar-reserva";
import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** YYYY-MM-DD en UTC (misma convención que el cron original). */
function todayUtcDateString() {
  return new Date().toISOString().split("T")[0];
}

async function alreadySentServicioCompletado(clienteId, bookingId) {
  if (!clienteId || !bookingId) return false;
  const { data } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", clienteId)
    .eq("tipo", "servicio_completado")
    .eq("booking_id", bookingId)
    .maybeSingle();
  return Boolean(data);
}

async function logServicioCompletado(clienteId, bookingId) {
  if (!clienteId || !bookingId) return;
  const { error } = await supabase.from("email_logs").insert({
    user_id: clienteId,
    tipo: "servicio_completado",
    booking_id: bookingId,
  });
  if (error && error.code !== "23505") {
    console.error(
      "[cron/actualizar-estados] email_logs servicio_completado:",
      error.message,
    );
  }
}

/**
 * Avanza estados de reservas:
 * 1) confirmada → en_curso al llegar fecha_inicio
 * 2) email «servicio_completado» cuando el fin efectivo ya pasó (sin completar aún)
 * 3) auto-completar + liberar pago a las 72h del fin (Vía 2, misma F2)
 * 4) reintentar capturas atascadas (completada sin pago_liberado_at)
 * 5) completada + problema → incidencia
 */
export async function runActualizarEstados() {
  const hoy = todayUtcDateString();

  const { data: paraIniciar } = await supabase
    .from("bookings")
    .select("id")
    .eq("estado", "confirmada")
    .lte("fecha_inicio", hoy);

  if (paraIniciar?.length) {
    await supabase
      .from("bookings")
      .update({ estado: "en_curso" })
      .in(
        "id",
        paraIniciar.map((b) => b.id),
      );
  }

  // Candidatos a email de confirmación / auto-complete: en_curso o confirmada
  // (por si el cron falló al pasar a en_curso).
  const { data: activas } = await supabase
    .from("bookings")
    .select(
      "id, cliente_id, estado, fecha_inicio, fecha_fin, payment_intent_id, confirmacion_cliente, pago_liberado_at, completada_at, services:service_id(titulo)",
    )
    .in("estado", ["en_curso", "confirmada"]);

  let emailsConfirmacion = 0;
  let completadasCron = 0;
  let erroresCompletar = 0;

  for (const booking of activas || []) {
    const end = getBookingEffectiveEndDate(booking);
    if (!end || end > hoy) continue;

    // Email al cliente cuando el servicio ya terminó (Vía 1), sin completar aún.
    if (
      booking.estado === "en_curso" &&
      booking.confirmacion_cliente == null &&
      !(await alreadySentServicioCompletado(booking.cliente_id, booking.id))
    ) {
      try {
        const result = await sendPlatformEmail({
          tipo: "servicio_completado",
          booking_id: booking.id,
          cliente_id: booking.cliente_id,
          payment_intent_id: booking.payment_intent_id || "",
        });
        if (result.ok) {
          await logServicioCompletado(booking.cliente_id, booking.id);
          emailsConfirmacion += 1;
        } else {
          console.error(
            "[cron/actualizar-estados] Error email servicio_completado",
            booking.id,
            result.error || result.status,
          );
        }
      } catch (emailErr) {
        console.error(
          "[cron/actualizar-estados] Error email servicio_completado",
          booking.id,
          emailErr?.message ?? emailErr,
        );
      }
    }

    // Vía 2: 72h tras fin efectivo → completar + liberar (idempotente con Vía 1).
    if (
      effectiveEndElapsedAfterHours(booking, CRON_COMPLETE_AFTER_HOURS) &&
      booking.confirmacion_cliente !== "problema"
    ) {
      const result = await completarReservaYLiberarPago(supabase, booking.id, {
        source: "cron",
        liberarPago: true,
        notifyReview: true,
      });
      if (result.ok) {
        if (result.completed) completadasCron += 1;
      } else {
        erroresCompletar += 1;
        console.error(
          "[cron/actualizar-estados] Error completar respaldo",
          booking.id,
          result.error,
        );
      }
    }
  }

  const { data: conProblema } = await supabase
    .from("bookings")
    .select("id")
    .eq("estado", "completada")
    .eq("confirmacion_cliente", "problema");

  for (const booking of conProblema || []) {
    await supabase
      .from("bookings")
      .update({ estado: "incidencia" })
      .eq("id", booking.id);
  }

  // Reintento: completada sin pago liberado (p.ej. captura fallida tras ok antiguo).
  const { data: paraReintentarPago } = await supabase
    .from("bookings")
    .select("id, payment_intent_id, confirmacion_cliente, pago_liberado_at")
    .eq("estado", "completada")
    .is("pago_liberado_at", null)
    .not("payment_intent_id", "is", null)
    .neq("confirmacion_cliente", "problema");

  let liberadasRetry = 0;
  for (const booking of paraReintentarPago || []) {
    try {
      const capture = await capturarYTransferirPago(
        supabase,
        booking.payment_intent_id,
        { logPrefix: "[cron/actualizar-estados:retry]" },
      );
      if (capture?.success || capture?.already_processed) {
        liberadasRetry += 1;
        if (booking.confirmacion_cliente !== "ok") {
          await supabase
            .from("bookings")
            .update({
              confirmacion_cliente: "ok",
              confirmado_at: new Date().toISOString(),
            })
            .eq("id", booking.id)
            .neq("confirmacion_cliente", "problema");
        }
      }
    } catch (captureErr) {
      console.error(
        "[cron/actualizar-estados] Error reintento captura",
        booking.id,
        captureErr?.message ?? captureErr,
      );
    }
  }

  return {
    iniciadas: paraIniciar?.length || 0,
    emails_confirmacion: emailsConfirmacion,
    completadas: completadasCron,
    errores_completar: erroresCompletar,
    liberadas: liberadasRetry,
  };
}
