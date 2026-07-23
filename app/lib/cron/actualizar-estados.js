import { createClient } from "@supabase/supabase-js";
import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { createNotification } from "@/app/lib/notifications";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** YYYY-MM-DD en UTC (misma convención que el cron original). */
function todayUtcDateString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * PostgREST: COALESCE(fecha_fin, fecha_inicio) <= hoy
 * - Con fecha_fin (alojamiento/mascotas): fecha_fin <= hoy
 * - Sin fecha_fin (niñera): fecha_inicio <= hoy
 */
function buildEffectiveEndDateLteFilter(hoy) {
  return `fecha_fin.lte.${hoy},and(fecha_fin.is.null,fecha_inicio.lte.${hoy})`;
}

/**
 * Avanza estados de reservas y captura pagos pendientes (24h post-completada).
 * Captura vía función compartida (sin HTTP interno).
 */
export async function runActualizarEstados() {
  const ahora = new Date().toISOString();
  const hoy = todayUtcDateString();
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

  const { data: paraCompletar } = await supabase
    .from("bookings")
    .select(
      "id, cliente_id, service_id, payment_intent_id, precio_total, services:service_id(titulo)",
    )
    .eq("estado", "en_curso")
    .is("confirmacion_cliente", null)
    .or(buildEffectiveEndDateLteFilter(hoy));

  for (const booking of paraCompletar || []) {
    await supabase
      .from("bookings")
      .update({ estado: "completada", completada_at: ahora })
      .eq("id", booking.id);

    try {
      const result = await sendPlatformEmail({
        tipo: "servicio_completado",
        booking_id: booking.id,
        cliente_id: booking.cliente_id,
      });
      if (!result.ok) {
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

    try {
      const servicioTitulo =
        booking.services?.titulo?.trim() || "tu servicio";
      await createNotification(null, {
        user_id: booking.cliente_id,
        tipo: "deja_resena",
        titulo: "¿Cómo fue tu servicio?",
        mensaje: `Cuéntanos cómo fue ${servicioTitulo} y ayuda a otras familias.`,
        href: `/resena/${booking.id}`,
        entity_type: "booking",
        entity_id: booking.id,
      });
    } catch (notifErr) {
      console.error(
        "[cron/actualizar-estados] Error notificación deja_resena",
        booking.id,
        notifErr?.message ?? notifErr,
      );
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

  const { data: paraLiberar } = await supabase
    .from("bookings")
    .select("id, payment_intent_id, confirmacion_cliente, completada_at")
    .eq("estado", "completada")
    .is("confirmacion_cliente", null)
    .not("payment_intent_id", "is", null)
    .not("completada_at", "is", null)
    .lte("completada_at", hace24h);

  for (const booking of paraLiberar || []) {
    if (booking.confirmacion_cliente === "problema") {
      await supabase
        .from("bookings")
        .update({ estado: "incidencia" })
        .eq("id", booking.id);
      continue;
    }

    try {
      await capturarYTransferirPago(supabase, booking.payment_intent_id, {
        logPrefix: "[cron/actualizar-estados]",
      });
    } catch (captureErr) {
      console.error(
        "[cron/actualizar-estados] Error capturando pago",
        booking.id,
        captureErr?.message ?? captureErr,
      );
      continue;
    }

    await supabase
      .from("bookings")
      .update({ confirmacion_cliente: "ok" })
      .eq("id", booking.id);
  }

  return {
    iniciadas: paraIniciar?.length || 0,
    completadas: paraCompletar?.length || 0,
    liberadas: paraLiberar?.length || 0,
  };
}
