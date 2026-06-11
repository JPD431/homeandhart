import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date().toISOString();
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: paraIniciar } = await supabase
    .from("bookings")
    .select("id")
    .eq("estado", "confirmada")
    .lte("fecha_inicio", ahora.split("T")[0]);

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
    .lte("fecha_fin", ahora.split("T")[0]);

  for (const booking of paraCompletar || []) {
    await supabase
      .from("bookings")
      .update({ estado: "completada" })
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
    .select("id, payment_intent_id, confirmacion_cliente")
    .eq("estado", "completada")
    .is("confirmacion_cliente", null)
    .not("payment_intent_id", "is", null)
    .lte("updated_at", hace24h);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: booking.payment_intent_id,
        proveedores: [],
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
