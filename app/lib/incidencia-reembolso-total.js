import Stripe from "stripe";
import {
  aplicarReembolsoStripeBooking,
  calcularReembolsoTotal,
  contarBookingsPorPaymentIntent,
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const LOG_PREFIX = "[reembolso]";

export function idempotencyKeyReembolsoTotal(bookingId) {
  return `incidencia-reembolso-total-${bookingId}`;
}

/**
 * Devuelve credito_aplicado al saldo del cliente, como máximo una vez por reserva.
 * Reclama en bookings.reembolso_cliente_credito antes de tocar profiles (idempotente).
 */
async function devolverCreditoResolucionIdempotente(
  supabaseAdmin,
  booking,
  reembolso,
) {
  const credito = reembolso.credito;

  if (!credito || credito <= 0) {
    console.error(`${LOG_PREFIX} credito`, {
      bookingId: booking.id,
      skipped: true,
      reason: "sin_credito_aplicado",
    });
    return { credito_devuelto: 0, skipped: true, reason: "sin_credito_aplicado" };
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from("bookings")
    .select("reembolso_cliente_credito")
    .eq("id", booking.id)
    .maybeSingle();

  if (readError) {
    console.error(`${LOG_PREFIX} credito`, {
      bookingId: booking.id,
      ok: false,
      message: readError.message,
    });
    throw readError;
  }

  if (existing?.reembolso_cliente_credito != null) {
    console.error(`${LOG_PREFIX} credito`, {
      bookingId: booking.id,
      skipped: true,
      reason: "reembolso_cliente_credito_ya_registrado",
      reembolso_cliente_credito: existing.reembolso_cliente_credito,
    });
    return {
      credito_devuelto: 0,
      skipped: true,
      reason: "ya_registrado_en_booking",
    };
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({
      reembolso_cliente_credito: credito,
      reembolso_cliente_total: reembolso.bruto,
      reembolso_cliente_pct: 100,
    })
    .eq("id", booking.id)
    .is("reembolso_cliente_credito", null)
    .select("id");

  if (claimError) {
    console.error(`${LOG_PREFIX} credito`, {
      bookingId: booking.id,
      ok: false,
      message: claimError.message,
      code: claimError.code,
    });
    throw claimError;
  }

  if (!claimed?.length) {
    console.error(`${LOG_PREFIX} credito`, {
      bookingId: booking.id,
      skipped: true,
      reason: "claim_sin_filas_otro_proceso",
    });
    return { credito_devuelto: 0, skipped: true, reason: "claim_sin_filas" };
  }

  await devolverCreditoCliente(
    supabaseAdmin,
    booking.cliente_id,
    credito,
    LOG_PREFIX,
  );

  console.error(`${LOG_PREFIX} credito`, {
    bookingId: booking.id,
    ok: true,
    credito_devuelto: credito,
  });

  return { credito_devuelto: credito, skipped: false };
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
        step: "bundle_count",
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
    let piAntes = null;
    try {
      piAntes = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
      console.error(`${LOG_PREFIX} stripe-antes`, {
        bookingId: booking.id,
        payment_intent_id: booking.payment_intent_id,
        pi_status: piAntes.status,
        pi_amount_cents: piAntes.amount,
        reembolso_tarjeta: reembolso.tarjeta,
        reembolso_tarjeta_cents: Math.round(reembolso.tarjeta * 100),
        idempotencyKey,
      });
    } catch (retrieveErr) {
      console.error(`${LOG_PREFIX} stripe-antes`, {
        bookingId: booking.id,
        payment_intent_id: booking.payment_intent_id,
        ok: false,
        message: retrieveErr?.message ?? String(retrieveErr),
        type: retrieveErr?.type,
        code: retrieveErr?.code,
      });
      return {
        success: false,
        status: 500,
        step: "stripe_retrieve",
        error: retrieveErr?.message ?? String(retrieveErr),
        stripe_type: retrieveErr?.type,
        stripe_code: retrieveErr?.code,
      };
    }

    try {
      stripeResult = await aplicarReembolsoStripeBooking(
        stripe,
        booking.payment_intent_id,
        reembolso.tarjeta,
        { idempotencyKey },
      );
      console.error(`${LOG_PREFIX} stripe-despues`, {
        bookingId: booking.id,
        ok: true,
        pi_status_antes: piAntes?.status,
        stripe_action: stripeResult.stripe_action,
        stripe_ok: stripeResult.stripe_ok,
        pi_status_resultado: stripeResult.pi_status,
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} stripe-despues`, {
        bookingId: booking.id,
        ok: false,
        message: err?.message ?? String(err),
        type: err?.type,
        code: err?.code,
      });
      return {
        success: false,
        status: 500,
        step: "stripe",
        error: err?.message ?? String(err),
        stripe: stripeResult,
        stripe_type: err?.type,
        stripe_code: err?.code,
      };
    }

    if (!stripeResult.stripe_ok) {
      console.error(`${LOG_PREFIX} stripe-despues`, {
        bookingId: booking.id,
        ok: false,
        stripe_error: stripeResult.stripe_error,
        stripe_action: stripeResult.stripe_action,
        pi_status: stripeResult.pi_status,
      });
      return {
        success: false,
        status: 502,
        step: "stripe",
        error: stripeResult.stripe_error || "Error al procesar el reembolso en Stripe.",
        stripe: stripeResult,
      };
    }
  }

  let creditoResult = { credito_devuelto: 0, skipped: true, reason: "sin_credito_aplicado" };

  try {
    creditoResult = await devolverCreditoResolucionIdempotente(
      supabaseAdmin,
      booking,
      reembolso,
    );
  } catch (creditoErr) {
    return {
      success: false,
      status: 500,
      step: "credito",
      error: creditoErr?.message ?? String(creditoErr),
      stripe: stripeResult,
      reembolso,
    };
  }

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
    console.error(`${LOG_PREFIX} db-update`, {
      bookingId: booking.id,
      ok: false,
      message: updateError.message,
      code: updateError.code,
      details: updateError.details,
      hint: updateError.hint,
    });
    const hint = updateError.message.includes("resolucion_")
      ? "Ejecuta la migración SQL de columnas resolucion_* en bookings."
      : updateError.message.includes("incidencia_resuelta")
        ? "El estado incidencia_resuelta puede no estar permitido en el CHECK de bookings.estado."
        : undefined;

    return {
      success: false,
      status: 500,
      step: "db_update",
      error: updateError.message,
      hint,
      db_code: updateError.code,
      db_hint: updateError.hint,
      stripe: stripeResult,
      reembolso,
    };
  }

  console.error(`${LOG_PREFIX} db-update`, {
    bookingId: booking.id,
    ok: true,
    rows_updated: updatedRows?.length ?? 0,
    estado_nuevo: "incidencia_resuelta",
  });

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

    console.error(`${LOG_PREFIX} db-update`, {
      bookingId: booking.id,
      ok: false,
      reason: "zero_rows_updated",
      estado_actual: current?.estado,
    });

    return {
      success: false,
      status: 409,
      step: "db_update",
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
    credito_devuelto_este_intento: creditoResult.credito_devuelto,
    credito_skip: creditoResult.skipped,
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
    credito: creditoResult,
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
