import Stripe from "stripe";
import {
  aplicarReembolsoStripeBooking,
  calcularReembolsoTotal,
  contarBookingsPorPaymentIntent,
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const LOG_PREFIX = "[admin/incidencia-reembolso-total]";

export function idempotencyKeyReembolsoTotal(bookingId) {
  return `incidencia-reembolso-total-${bookingId}`;
}

export async function ejecutarReembolsoTotalIncidencia(supabaseAdmin, booking, adminId, nota) {
  if (booking.estado === "incidencia_resuelta") {
    if (booking.resolucion_tipo === "reembolso_total") {
      return {
        success: true,
        already_processed: true,
        booking_id: booking.id,
        resolucion_tipo: booking.resolucion_tipo,
        resolucion_at: booking.resolucion_at,
      };
    }

    return {
      success: false,
      status: 409,
      error: "La reserva ya fue resuelta con otro tipo de resolución.",
    };
  }

  if (booking.estado !== "incidencia") {
    return {
      success: false,
      status: 409,
      error: "La reserva no está en estado incidencia.",
    };
  }

  const reembolso = calcularReembolsoTotal(booking);
  const idempotencyKey = idempotencyKeyReembolsoTotal(booking.id);

  let bookingsEnGrupo = 1;
  let bundleWarning = null;

  if (booking.payment_intent_id) {
    try {
      bookingsEnGrupo = await contarBookingsPorPaymentIntent(
        supabaseAdmin,
        booking.payment_intent_id,
      );
    } catch (err) {
      return {
        success: false,
        status: 500,
        error: err?.message ?? String(err),
      };
    }

    if (bookingsEnGrupo > 1 && reembolso.tarjeta > 0) {
      bundleWarning =
        "PaymentIntent compartido: se reembolsa solo el importe de esta reserva. " +
        "Si el pago estaba retenido, se captura el resto del PI (otras verticales del bundle).";
      console.warn(LOG_PREFIX, "Bundle detectado", {
        bookingId: booking.id,
        payment_intent_id: booking.payment_intent_id,
        bookingsEnGrupo,
        reembolso_tarjeta: reembolso.tarjeta,
      });
    }
  }

  let stripeResult = { stripe_ok: true, stripe_action: "sin_pi" };

  if (reembolso.tarjeta > 0 && booking.payment_intent_id) {
    try {
      stripeResult = await aplicarReembolsoStripeBooking(
        stripe,
        booking.payment_intent_id,
        reembolso.tarjeta,
        { idempotencyKey },
      );
    } catch (err) {
      console.error(LOG_PREFIX, "Error Stripe:", err?.message ?? err, {
        bookingId: booking.id,
      });
      return {
        success: false,
        status: 500,
        error: err?.message ?? String(err),
        stripe: stripeResult,
      };
    }

    if (!stripeResult.stripe_ok) {
      return {
        success: false,
        status: 502,
        error: stripeResult.stripe_error || "Error al procesar el reembolso en Stripe.",
        stripe: stripeResult,
      };
    }
  }

  await devolverCreditoCliente(
    supabaseAdmin,
    booking.cliente_id,
    reembolso.credito,
    LOG_PREFIX,
  );

  const resolucionAt = new Date().toISOString();

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "incidencia_resuelta",
      resolucion_tipo: "reembolso_total",
      resolucion_at: resolucionAt,
      resolucion_admin_id: adminId,
      resolucion_nota: nota?.trim() || null,
      resolucion_importe_cliente: reembolso.bruto,
      resolucion_importe_proveedor: 0,
      reembolso_cliente_pct: 100,
      reembolso_cliente_total: reembolso.bruto,
      reembolso_cliente_credito: reembolso.credito,
    })
    .eq("id", booking.id)
    .eq("estado", "incidencia")
    .select("id");

  if (updateError) {
    console.error(LOG_PREFIX, "Error actualizando booking:", updateError);
    return {
      success: false,
      status: 500,
      error: updateError.message,
      stripe: stripeResult,
      reembolso,
    };
  }

  if (!updatedRows?.length) {
    const { data: current } = await supabaseAdmin
      .from("bookings")
      .select("estado, resolucion_tipo, resolucion_at")
      .eq("id", booking.id)
      .maybeSingle();

    if (
      current?.estado === "incidencia_resuelta" &&
      current?.resolucion_tipo === "reembolso_total"
    ) {
      return {
        success: true,
        already_processed: true,
        booking_id: booking.id,
        resolucion_at: current.resolucion_at,
      };
    }

    return {
      success: false,
      status: 409,
      error: "No se pudo actualizar la reserva; el estado cambió durante el proceso.",
    };
  }

  const { error: reportsError } = await supabaseAdmin
    .from("reports")
    .update({ estado: "resuelto" })
    .eq("booking_id", booking.id)
    .in("estado", ["pendiente"]);

  if (reportsError) {
    console.error(LOG_PREFIX, "Error marcando reports resueltos:", reportsError);
  }

  console.info(LOG_PREFIX, "Reembolso total aplicado", {
    booking_id: booking.id,
    admin_id: adminId,
    reembolso_bruto: reembolso.bruto,
    reembolso_tarjeta: reembolso.tarjeta,
    reembolso_credito: reembolso.credito,
    stripe_action: stripeResult.stripe_action,
    bundle: bookingsEnGrupo > 1,
  });

  return {
    success: true,
    booking_id: booking.id,
    estado: "incidencia_resuelta",
    resolucion_tipo: "reembolso_total",
    resolucion_at: resolucionAt,
    reembolso: {
      ...reembolso,
      importe_cliente: reembolso.bruto,
      importe_proveedor: 0,
    },
    stripe: stripeResult,
    bundle_warning: bundleWarning,
    is_bundle: bookingsEnGrupo > 1,
  };
}

export async function enviarEmailReembolsoIncidencia(booking, service, reembolso) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, email omitido");
    return;
  }

  const proveedor = service?.profiles ?? service?.profiles_public;
  const proveedorNombre =
    [proveedor?.nombre, proveedor?.apellido].filter(Boolean).join(" ").trim() || undefined;

  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "incidencia_reembolso_cliente",
        cliente_id: booking.cliente_id,
        servicio_titulo: service?.titulo || "Servicio Home&Heart",
        proveedor_nombre: proveedorNombre,
        fecha_inicio: booking.fecha_inicio,
        fecha_fin: booking.fecha_fin,
        reembolso_total: roundMoney(reembolso.bruto),
        reembolso_tarjeta: roundMoney(reembolso.tarjeta),
        reembolso_credito: roundMoney(reembolso.credito),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(LOG_PREFIX, "Error enviando email:", data.error || res.status);
    }
  } catch (err) {
    console.error(LOG_PREFIX, "Error enviando email:", err);
  }
}
