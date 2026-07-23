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

    const { paymentIntentId, bookingId, token } = await request.json();

    if (!isInternalCall) {
      if (
        !bookingId ||
        !token ||
        !verificarTokenConfirmacion(bookingId, token)
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let resolvedPaymentIntentId = paymentIntentId;

    if (!resolvedPaymentIntentId && bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("payment_intent_id")
        .eq("id", bookingId)
        .single();

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

    if (!isInternalCall && bookingId) {
      const { error: confirmError } = await supabase
        .from("bookings")
        .update({
          confirmacion_cliente: "ok",
          confirmado_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

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

    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error capture-payment:", error.message, error.type, error.code);
    return Response.json(
      { error: error.message, type: error.type, code: error.code },
      { status: 500 },
    );
  }
}
