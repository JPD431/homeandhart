import { createClient } from "@supabase/supabase-js";
import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";
import { isInternalApiAuthorized } from "@/app/lib/internal-api-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request) {
  try {
    const isInternalCall = isInternalApiAuthorized(request);

    const body = await request.json();
    const { paymentIntentId, bookingId, token } = body ?? {};

    let resolvedPaymentIntentId = paymentIntentId ?? null;
    let resolvedBookingId = bookingId ?? null;

    if (!isInternalCall) {
      // Flujo usuario (enlace email): exige token atado a booking + PI de esa reserva.
      // Nunca confiamos en un paymentIntentId enviado por el cliente.
      if (!bookingId || !token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, payment_intent_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError || !booking) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const bookingPi = booking.payment_intent_id;
      if (!bookingPi) {
        return Response.json(
          { error: "No se encontró payment_intent_id para esta reserva" },
          { status: 400 },
        );
      }

      // Si el cliente envía un PI distinto al de la reserva → rechazo (ataque cruzado).
      if (paymentIntentId && paymentIntentId !== bookingPi) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!verificarTokenConfirmacion(bookingId, bookingPi, token)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      resolvedPaymentIntentId = bookingPi;
      resolvedBookingId = booking.id;
    } else {
      // Llamada interna (Bearer CRON_SECRET): sin token; resolver PI desde booking si falta.
      if (!resolvedPaymentIntentId && resolvedBookingId) {
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .select("payment_intent_id")
          .eq("id", resolvedBookingId)
          .maybeSingle();

        if (bookingError || !booking?.payment_intent_id) {
          return Response.json(
            { error: "No se encontró payment_intent_id para esta reserva" },
            { status: 400 },
          );
        }

        resolvedPaymentIntentId = booking.payment_intent_id;
      }

      if (!resolvedPaymentIntentId) {
        return Response.json(
          { error: "Falta paymentIntentId o bookingId" },
          { status: 400 },
        );
      }

      // El PI debe pertenecer a al menos una reserva real.
      const { data: linkedBookings, error: linkError } = await supabase
        .from("bookings")
        .select("id")
        .eq("payment_intent_id", resolvedPaymentIntentId)
        .limit(1);

      if (linkError || !linkedBookings?.length) {
        return Response.json(
          { error: "PaymentIntent no asociado a ninguna reserva" },
          { status: 400 },
        );
      }
    }

    if (!isInternalCall && resolvedBookingId) {
      const { error: confirmError } = await supabase
        .from("bookings")
        .update({
          confirmacion_cliente: "ok",
          confirmado_at: new Date().toISOString(),
        })
        .eq("id", resolvedBookingId);

      if (confirmError) {
        return Response.json({ error: confirmError.message }, { status: 500 });
      }
    }

    const result = await capturarYTransferirPago(supabase, resolvedPaymentIntentId, {
      logPrefix: "[capture-payment]",
    });

    if (result.already_processed) {
      return Response.json({ success: true, already_processed: true });
    }

    if (result.error && !result.success) {
      const status =
        result.error_code === "pi_not_capturable" ||
        result.error_code === "pi_canceled"
          ? 409
          : 500;
      return Response.json(result, { status });
    }

    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error capture-payment:", error.message, error.type, error.code);
    return Response.json(
      { error: error.message, type: error.type, code: error.code },
      { status: 500 },
    );
  }
}
