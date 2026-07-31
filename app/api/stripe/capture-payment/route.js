import { createClient } from "@supabase/supabase-js";
import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { completarReservaYLiberarPago } from "@/app/lib/completar-reserva";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";
import { isInternalApiAuthorized } from "@/app/lib/internal-api-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/stripe/capture-payment
 *
 * - Usuario (email): bookingId + token → completar + liberar (F2, idempotente).
 * - Interno (CRON_SECRET): captura/transfer por PI (sin cambiar estado).
 */
export async function POST(request) {
  try {
    const isInternalCall = isInternalApiAuthorized(request);

    const body = await request.json();
    const { paymentIntentId, bookingId, token } = body ?? {};

    let resolvedPaymentIntentId = paymentIntentId ?? null;
    let resolvedBookingId = bookingId ?? null;

    if (!isInternalCall) {
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
      if (
        paymentIntentId &&
        bookingPi &&
        paymentIntentId !== bookingPi
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!verificarTokenConfirmacion(bookingId, bookingPi || "", token)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await completarReservaYLiberarPago(supabase, booking.id, {
        source: "email",
        liberarPago: true,
        notifyReview: true,
      });

      if (!result.ok) {
        const status = result.status || 500;
        return Response.json(
          { error: result.error, capture: result.capture },
          { status },
        );
      }

      return Response.json({
        success: true,
        completed: result.completed,
        already_completed: result.already_completed,
        already_paid: result.already_paid,
        already_processed: result.already_paid === true,
      });
    }

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
