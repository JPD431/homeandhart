import { createClient } from "@supabase/supabase-js";

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

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .select("id, cliente_id, service_id, payment_intent_id, precio_total")
    .eq("estado", "en_curso")
    .is("confirmacion_cliente", null)
    .or(buildEffectiveEndDateLteFilter(hoy));

  for (const booking of paraCompletar || []) {
    await supabase
      .from("bookings")
      .update({ estado: "completada", completada_at: ahora })
      .eq("id", booking.id);

    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "servicio_completado",
        booking_id: booking.id,
        cliente_id: booking.cliente_id,
      }),
    });
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

    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/stripe/capture-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        paymentIntentId: booking.payment_intent_id,
      }),
    });

    await supabase
      .from("bookings")
      .update({ confirmacion_cliente: "ok" })
      .eq("id", booking.id);
  }

  return Response.json({
    success: true,
    iniciadas: paraIniciar?.length || 0,
    completadas: paraCompletar?.length || 0,
    liberadas: paraLiberar?.length || 0,
  });
}
