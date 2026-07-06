import Stripe from "stripe";
import { capturarYTransferirPago } from "@/app/lib/capturar-y-transferir";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";
import {
  CANCELABLE_PI_STATUSES,
  contarBookingsPorPaymentIntent,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const LOG_PREFIX = "[liberar-proveedor]";

export function calcularImporteProveedorEstimado(booking) {
  return roundMoney(getIngresoProveedorFromBooking(booking));
}

async function ejecutarCaptureProveedorStripe(supabaseAdmin, booking, bookingsEnGrupo) {
  if (!booking.payment_intent_id) {
    return { stripe_ok: true, stripe_action: "sin_pi" };
  }

  if (bookingsEnGrupo > 1) {
    return {
      stripe_ok: false,
      stripe_action: null,
      pi_status: null,
      stripe_error:
        "PaymentIntent compartido (bundle): liberar al proveedor de un solo servicio requiere gestión manual. Contacta soporte técnico.",
      is_bundle: true,
    };
  }

  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
  } catch (err) {
    return {
      stripe_ok: false,
      stripe_action: null,
      stripe_error: err?.message ?? String(err),
      stripe_type: err?.type,
      stripe_code: err?.code,
    };
  }

  const piStatus = pi.status;

  console.error(`${LOG_PREFIX} stripe-antes`, {
    bookingId: booking.id,
    payment_intent_id: booking.payment_intent_id,
    pi_status: piStatus,
    pago_liberado_at: booking.pago_liberado_at,
    bookings_en_grupo: bookingsEnGrupo,
  });

  if (piStatus === "canceled") {
    return {
      stripe_ok: false,
      stripe_action: null,
      pi_status: piStatus,
      stripe_error: "El pago ya está cancelado, no se puede pagar al proveedor.",
    };
  }

  if (booking.pago_liberado_at) {
    return {
      stripe_ok: true,
      stripe_action: "already_captured",
      pi_status: piStatus,
    };
  }

  if (piStatus === "succeeded" || CANCELABLE_PI_STATUSES.has(piStatus)) {
    let capture;
    try {
      capture = await capturarYTransferirPago(
        supabaseAdmin,
        booking.payment_intent_id,
        { logPrefix: LOG_PREFIX },
      );
    } catch (err) {
      return {
        stripe_ok: false,
        stripe_action: null,
        pi_status: piStatus,
        stripe_error: err?.message ?? String(err),
      };
    }

    console.error(`${LOG_PREFIX} stripe-despues`, {
      bookingId: booking.id,
      ok: capture.success,
      pi_status: piStatus,
      already_processed: capture.already_processed,
      error: capture.error,
    });

    if (capture.success || capture.already_processed) {
      return {
        stripe_ok: true,
        stripe_action: piStatus === "succeeded" ? "already_captured" : "capture",
        pi_status: piStatus,
        capture,
      };
    }

    return {
      stripe_ok: false,
      stripe_action: null,
      pi_status: piStatus,
      stripe_error: capture.error || "Error al capturar y transferir al proveedor.",
      capture,
    };
  }

  return {
    stripe_ok: false,
    stripe_action: null,
    pi_status: piStatus,
    stripe_error: `Estado del PaymentIntent no manejado para liberar proveedor: ${piStatus}`,
  };
}

export async function ejecutarLiberarProveedorIncidencia(
  supabaseAdmin,
  booking,
  adminId,
  nota,
) {
  if (booking.estado === "incidencia_resuelta") {
    if (booking.resolucion_tipo === "liberado_proveedor") {
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
      step: "validate_estado",
      error: "La reserva ya fue resuelta con otro tipo de resolución.",
    };
  }

  if (booking.estado !== "incidencia") {
    return {
      success: false,
      status: 409,
      step: "validate_estado",
      error: "La reserva no está en estado incidencia.",
    };
  }

  const importeProveedorEstimado = calcularImporteProveedorEstimado(booking);

  let bookingsEnGrupo = 1;
  try {
    bookingsEnGrupo = await contarBookingsPorPaymentIntent(
      supabaseAdmin,
      booking.payment_intent_id,
    );
  } catch (err) {
    return {
      success: false,
      status: 500,
      step: "bundle_count",
      error: err?.message ?? String(err),
    };
  }

  const stripeResult = await ejecutarCaptureProveedorStripe(
    supabaseAdmin,
    booking,
    bookingsEnGrupo,
  );

  if (!stripeResult.stripe_ok) {
    return {
      success: false,
      status: stripeResult.is_bundle ? 409 : 502,
      step: "stripe",
      error: stripeResult.stripe_error,
      stripe: stripeResult,
      hint: stripeResult.is_bundle
        ? "En bundles, usa soporte para no afectar otras verticales del mismo pago."
        : undefined,
    };
  }

  const { data: refreshed, error: refreshError } = await supabaseAdmin
    .from("bookings")
    .select("pago_liberado_at, importe_transferido")
    .eq("id", booking.id)
    .maybeSingle();

  if (refreshError) {
    return {
      success: false,
      status: 500,
      step: "booking_refresh",
      error: refreshError.message,
      stripe: stripeResult,
    };
  }

  const importeProveedor =
    refreshed?.importe_transferido != null
      ? roundMoney(refreshed.importe_transferido)
      : importeProveedorEstimado;

  const resolucionAt = new Date().toISOString();
  const liberadoAt = refreshed?.pago_liberado_at || resolucionAt;

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "incidencia_resuelta",
      resolucion_tipo: "liberado_proveedor",
      resolucion_at: resolucionAt,
      resolucion_admin_id: adminId,
      resolucion_nota: nota?.trim() || null,
      resolucion_importe_cliente: 0,
      resolucion_importe_proveedor: importeProveedor,
      confirmacion_cliente: "ok",
      confirmado_at: resolucionAt,
      pago_liberado_at: liberadoAt,
    })
    .eq("id", booking.id)
    .eq("estado", "incidencia")
    .select("id");

  if (updateError) {
    console.error(`${LOG_PREFIX} db-update`, {
      bookingId: booking.id,
      ok: false,
      message: updateError.message,
    });
    return {
      success: false,
      status: 500,
      step: "db_update",
      error: updateError.message,
      stripe: stripeResult,
      importe_proveedor: importeProveedor,
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
      current?.resolucion_tipo === "liberado_proveedor"
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
      step: "db_update",
      error: "No se pudo actualizar la reserva; el estado cambió durante el proceso.",
      stripe: stripeResult,
    };
  }

  await supabaseAdmin
    .from("reports")
    .update({ estado: "resuelto" })
    .eq("booking_id", booking.id)
    .in("estado", ["pendiente"]);

  console.error(`${LOG_PREFIX} db-update`, {
    bookingId: booking.id,
    ok: true,
    importe_proveedor: importeProveedor,
    stripe_action: stripeResult.stripe_action,
  });

  return {
    success: true,
    booking_id: booking.id,
    estado: "incidencia_resuelta",
    resolucion_tipo: "liberado_proveedor",
    resolucion_at: resolucionAt,
    importe_proveedor: importeProveedor,
    pago_liberado_at: liberadoAt,
    stripe: stripeResult,
    is_bundle: bookingsEnGrupo > 1,
  };
}

export async function enviarEmailsLiberarProveedorIncidencia(
  booking,
  service,
  importeProveedor,
) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, emails omitidos");
    return;
  }

  const proveedor = service?.profiles_public ?? service?.profiles;
  const proveedorId = service?.proveedor_id;
  const proveedorNombre =
    [proveedor?.nombre, proveedor?.apellido].filter(Boolean).join(" ").trim() || undefined;

  try {
    await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "incidencia_liberado_proveedor",
        proveedor_id: proveedorId,
        proveedor_nombre: proveedorNombre,
        servicio_titulo: service?.titulo || "Servicio Home&Heart",
        importe_proveedor: roundMoney(importeProveedor),
        booking_id: booking.id,
      }),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "email proveedor error:", err);
  }

  try {
    await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "incidencia_resuelta_cliente",
        cliente_id: booking.cliente_id,
        servicio_titulo: service?.titulo || "Servicio Home&Heart",
        proveedor_nombre: proveedorNombre,
        resolucion: "liberado_proveedor",
      }),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "email cliente error:", err);
  }
}
