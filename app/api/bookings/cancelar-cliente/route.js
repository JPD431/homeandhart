import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRefundPercent,
  getServiceStartDateTime,
} from "@/app/lib/cancelacion-politica";
import { calcularRepartoCancelacionCliente } from "@/app/lib/cancelacion-cliente-reparto";
import { ejecutarTransferProveedorConDeudaSaldo } from "@/app/lib/transfer-proveedor";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ESTADOS_CANCELABLES = new Set(["pendiente", "confirmada"]);

/** PI pre-captura: cancel o capture parcial liberan el resto. */
const CANCELABLE_PI_STATUSES = new Set([
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "requires_payment_method",
  "processing",
]);

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

async function devolverCreditoCliente(clienteId, importe) {
  if (!importe || importe <= 0) return;

  try {
    const { data: profile, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("credito_disponible")
      .eq("id", clienteId)
      .maybeSingle();

    if (readError || !profile) {
      console.error(
        "[bookings/cancelar-cliente] No se pudo leer credito_disponible:",
        readError?.message || "Perfil no encontrado",
        { clienteId },
      );
      return;
    }

    const actual = Number(profile.credito_disponible) || 0;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ credito_disponible: roundMoney(actual + importe) })
      .eq("id", clienteId);

    if (updateError) {
      console.error(
        "[bookings/cancelar-cliente] No se pudo devolver credito_disponible:",
        updateError,
        { clienteId, importe },
      );
    }
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] No se pudo devolver credito_disponible:",
      err,
      { clienteId, importe },
    );
  }
}

/**
 * Reembolso Stripe — solo reserva única con ese payment_intent_id.
 * requires_capture: cancel (100% tarjeta) o capture parcial (libera reembolsoTarjeta).
 * succeeded: refund parcial por reembolsoTarjeta.
 */
async function aplicarReembolsoStripeSingleBooking(
  paymentIntentId,
  reembolsoTarjeta,
) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const { status, amount: piAmountCents } = paymentIntent;

  if (reembolsoTarjeta <= 0) {
    return { stripe_ok: true };
  }

  const reembolsoCents = Math.round(reembolsoTarjeta * 100);

  if (CANCELABLE_PI_STATUSES.has(status)) {
    if (reembolsoCents >= piAmountCents) {
      await stripe.paymentIntents.cancel(paymentIntentId);
      return { stripe_ok: true };
    }

    const amountToCapture = piAmountCents - reembolsoCents;
    if (amountToCapture <= 0) {
      await stripe.paymentIntents.cancel(paymentIntentId);
      return { stripe_ok: true };
    }

    await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountToCapture,
    });
    return { stripe_ok: true };
  }

  if (status === "succeeded") {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: reembolsoCents,
    });
    return { stripe_ok: true };
  }

  if (status === "canceled") {
    return { stripe_ok: true };
  }

  return {
    stripe_ok: false,
    stripe_error: `Estado del PaymentIntent no manejado: ${status}`,
  };
}

async function calcularYAplicarReembolso(booking, service) {
  const sinReembolso = {
    pct: 0,
    bruto: 0,
    tarjeta: 0,
    credito: 0,
    stripe_ok: true,
  };

  if (!service) {
    return sinReembolso;
  }

  const serviceStartAt = getServiceStartDateTime(
    service.vertical,
    booking.fecha_inicio,
    booking.hora,
  );

  const pct = getRefundPercent(
    service.cancellation_policy,
    new Date(),
    serviceStartAt,
  );

  if (pct === 0) {
    return sinReembolso;
  }

  const precioTotal = Number(booking.precio_total) || 0;
  const creditoAplicado = Number(booking.credito_aplicado) || 0;

  const reembolsoBruto = roundMoney((precioTotal * pct) / 100);

  let reembolsoCredito = 0;
  if (precioTotal > 0) {
    reembolsoCredito = roundMoney(
      reembolsoBruto * (creditoAplicado / precioTotal),
    );
  }

  const reembolsoTarjeta = roundMoney(reembolsoBruto - reembolsoCredito);

  await devolverCreditoCliente(booking.cliente_id, reembolsoCredito);

  let stripe_ok = true;
  let stripe_error;

  if (reembolsoTarjeta > 0 && booking.payment_intent_id) {
    try {
      const { data: grupoBookings, error: grupoError } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("payment_intent_id", booking.payment_intent_id);

      if (grupoError) {
        stripe_ok = false;
        stripe_error = grupoError.message;
        console.error(
          "[bookings/cancelar-cliente] Error leyendo grupo del PI:",
          grupoError,
          { bookingId: booking.id },
        );
      } else if ((grupoBookings?.length ?? 0) > 1) {
        stripe_ok = false;
        stripe_error =
          "Reembolso Stripe en bundle multi-booking pendiente de implementación";
        console.warn(
          "[bookings/cancelar-cliente] TODO: reembolso Stripe bundle multi-booking — no se movió dinero en Stripe",
          {
            bookingId: booking.id,
            payment_intent_id: booking.payment_intent_id,
            reembolsoTarjeta,
            bookingsEnGrupo: grupoBookings.length,
          },
        );
      } else {
        const stripeResult = await aplicarReembolsoStripeSingleBooking(
          booking.payment_intent_id,
          reembolsoTarjeta,
        );
        stripe_ok = stripeResult.stripe_ok;
        stripe_error = stripeResult.stripe_error;
      }
    } catch (err) {
      stripe_ok = false;
      stripe_error = err?.message ?? String(err);
      console.error(
        "[bookings/cancelar-cliente] Error Stripe al reembolsar:",
        stripe_error,
        {
          bookingId: booking.id,
          payment_intent_id: booking.payment_intent_id,
          reembolsoTarjeta,
        },
      );
    }
  }

  return {
    pct,
    bruto: reembolsoBruto,
    tarjeta: reembolsoTarjeta,
    credito: reembolsoCredito,
    stripe_ok,
    ...(stripe_error ? { stripe_error } : {}),
  };
}

async function contarBookingsPorPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return 1;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("payment_intent_id", paymentIntentId);

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

/**
 * Tras el reembolso: captura el tramo tarjeta no reembolsado si el PI sigue pre-captura.
 * Cierra el gap pct=0 (hoy no se capturaba → dinero colgado).
 */
async function asegurarCapturaStripeParaCompensacion(
  paymentIntentId,
  reembolsoTarjeta,
) {
  if (!paymentIntentId) {
    return { ok: true, chargeId: null, capturado_neto: 0 };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const { status, amount: piAmountCents } = paymentIntent;

  if (status === "succeeded") {
    return {
      ok: true,
      chargeId: paymentIntent.latest_charge,
      capturado_neto: roundMoney(piAmountCents / 100),
    };
  }

  if (CANCELABLE_PI_STATUSES.has(status)) {
    const reembolsoCents = Math.round((Number(reembolsoTarjeta) || 0) * 100);

    if (reembolsoCents >= piAmountCents) {
      return { ok: true, chargeId: null, capturado_neto: 0 };
    }

    const amountToCapture = piAmountCents - reembolsoCents;
    if (amountToCapture <= 0) {
      await stripe.paymentIntents.cancel(paymentIntentId);
      return { ok: true, chargeId: null, capturado_neto: 0 };
    }

    const captured = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountToCapture,
    });

    return {
      ok: true,
      chargeId: captured.latest_charge,
      capturado_neto: roundMoney(captured.amount / 100),
    };
  }

  if (status === "canceled") {
    return { ok: true, chargeId: null, capturado_neto: 0 };
  }

  return {
    ok: false,
    chargeId: null,
    capturado_neto: 0,
    error: `Estado del PaymentIntent no manejado para captura: ${status}`,
  };
}

async function aplicarCompensacionProveedorCancelacionCliente(
  booking,
  service,
  reembolso,
) {
  const sinCompensacion = {
    aplicada: false,
    skipped: true,
    motivo: null,
  };

  if (!service) {
    return { ...sinCompensacion, motivo: "sin_servicio" };
  }

  if (booking.compensacion_cancelacion != null) {
    return {
      aplicada: true,
      skipped: true,
      motivo: "ya_procesada",
      compensacion_cancelacion: Number(booking.compensacion_cancelacion),
    };
  }

  let bookingsEnGrupo = 1;
  try {
    bookingsEnGrupo = await contarBookingsPorPaymentIntent(
      booking.payment_intent_id,
    );
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] Error contando bookings del PI:",
      err,
      { bookingId: booking.id },
    );
    return {
      ...sinCompensacion,
      skipped: false,
      error: err?.message ?? String(err),
    };
  }

  if (bookingsEnGrupo > 1) {
    return { ...sinCompensacion, motivo: "bundle_multi_booking" };
  }

  if (!reembolso.stripe_ok) {
    return {
      ...sinCompensacion,
      skipped: false,
      motivo: "reembolso_stripe_fallido",
      error: reembolso.stripe_error,
    };
  }

  const pct = reembolso.pct;
  const precioTotal = Number(booking.precio_total) || 0;
  const creditoAplicado = Number(booking.credito_aplicado) || 0;
  const reparto = calcularRepartoCancelacionCliente(precioTotal, pct);

  const observabilidad = {
    pct,
    ...reparto,
    transferido: 0,
    saldo_pendiente_nuevo: null,
    saldo_pendiente_anterior: null,
    deuda_descontada: 0,
    amount_este_ciclo: 0,
    financiamiento: null,
    cobros_activos: null,
    captura_ok: null,
    capturado_neto: null,
    error: null,
  };

  if (reparto.parte_proveedor <= 0) {
    return {
      aplicada: false,
      skipped: true,
      motivo: "reembolso_total",
      ...observabilidad,
    };
  }

  const { data: serviceRow, error: serviceError } = await supabaseAdmin
    .from("services")
    .select(
      `
      id,
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id,
        cobros_activos,
        deuda_pendiente,
        saldo_pendiente_transferir
      )
    `,
    )
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError || !serviceRow?.proveedor_id) {
    const msg = serviceError?.message ?? "Servicio o proveedor no encontrado";
    console.error(
      "[bookings/cancelar-cliente] Error cargando proveedor:",
      msg,
      { bookingId: booking.id },
    );
    return {
      aplicada: false,
      skipped: false,
      motivo: "proveedor_no_encontrado",
      ...observabilidad,
      error: msg,
    };
  }

  const proveedor = serviceRow.profiles;
  observabilidad.cobros_activos = proveedor?.cobros_activos === true;
  observabilidad.saldo_pendiente_anterior = roundMoney(
    proveedor?.saldo_pendiente_transferir,
  );

  let chargeId = null;
  let capturadoNeto = 0;

  if (booking.payment_intent_id) {
    try {
      const captura = await asegurarCapturaStripeParaCompensacion(
        booking.payment_intent_id,
        reembolso.tarjeta,
      );
      observabilidad.captura_ok = captura.ok;
      observabilidad.capturado_neto = captura.capturado_neto;

      if (!captura.ok) {
        return {
          aplicada: false,
          skipped: false,
          motivo: "captura_fallida",
          ...observabilidad,
          error: captura.error,
        };
      }

      chargeId = captura.chargeId;
      capturadoNeto = captura.capturado_neto;
    } catch (err) {
      const msg = err?.message ?? String(err);
      console.error(
        "[bookings/cancelar-cliente] Error capturando PI para compensación:",
        msg,
        { bookingId: booking.id },
      );
      return {
        aplicada: false,
        skipped: false,
        motivo: "captura_fallida",
        ...observabilidad,
        captura_ok: false,
        error: msg,
      };
    }
  }

  const usePlatformBalance =
    creditoAplicado > 0 ||
    reparto.parte_proveedor > capturadoNeto;

  const transferSummary = await ejecutarTransferProveedorConDeudaSaldo({
    stripe,
    supabase: supabaseAdmin,
    proveedorId: serviceRow.proveedor_id,
    stripeAccountId: proveedor?.stripe_account_id ?? null,
    profile: proveedor,
    amountBruto: reparto.parte_proveedor,
    chargeId,
    usePlatformBalance,
    logPrefix: "[bookings/cancelar-cliente]",
  });

  observabilidad.transferido = transferSummary.transferido_stripe;
  observabilidad.saldo_pendiente_nuevo =
    transferSummary.saldo_pendiente_nuevo ?? null;
  observabilidad.deuda_descontada = transferSummary.deuda_descontada;
  observabilidad.amount_este_ciclo = transferSummary.amount_este_ciclo;
  observabilidad.financiamiento = transferSummary.financiamiento;

  if (!transferSummary.success) {
    return {
      aplicada: false,
      skipped: false,
      motivo: "transfer_fallida",
      ...observabilidad,
      error: transferSummary.error,
      transfer: transferSummary,
    };
  }

  const { error: bookingUpdateError } = await supabaseAdmin
    .from("bookings")
    .update({
      compensacion_cancelacion: reparto.parte_proveedor,
      importe_transferido: transferSummary.amount_este_ciclo,
    })
    .eq("id", booking.id);

  if (bookingUpdateError) {
    console.error(
      "[bookings/cancelar-cliente] Compensación transferida pero fallo al guardar booking:",
      bookingUpdateError,
      { bookingId: booking.id },
    );
    return {
      aplicada: false,
      skipped: false,
      motivo: "error_guardando_booking",
      ...observabilidad,
      error: bookingUpdateError.message,
      transfer: transferSummary,
      transfer_realizada: true,
    };
  }

  return {
    aplicada: true,
    skipped: false,
    motivo: transferSummary.skip_reason ?? null,
    compensacion_cancelacion: reparto.parte_proveedor,
    ...observabilidad,
    transfer: transferSummary,
  };
}

async function liberarFechasReserva(bookingId) {
  try {
    const { error } = await supabaseAdmin
      .from("disponibilidad")
      .delete()
      .eq("booking_id", bookingId);

    if (error) {
      console.error(
        "[bookings/cancelar-cliente] No se pudo liberar disponibilidad:",
        error,
        { bookingId },
      );
    }
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] No se pudo liberar disponibilidad:",
      err,
      { bookingId },
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const bookingId = body?.booking_id;

  if (!bookingId) {
    return NextResponse.json({ error: "Falta booking_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      cliente_id,
      service_id,
      estado,
      payment_intent_id,
      fecha_inicio,
      fecha_fin,
      precio_total,
      credito_aplicado,
      hora,
      grupo_reserva,
      compensacion_cancelacion,
      services:service_id (
        titulo,
        vertical,
        ciudad,
        cancellation_policy
      )
    `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (booking.cliente_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!ESTADOS_CANCELABLES.has(booking.estado)) {
    return NextResponse.json(
      { error: "Esta reserva no se puede cancelar" },
      { status: 409 },
    );
  }

  const service = booking.services;
  const canceladoAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "cancelada",
      cancelado_at: canceladoAt,
    })
    .eq("id", bookingId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await liberarFechasReserva(bookingId);

  const reembolso = await calcularYAplicarReembolso(booking, service);

  const compensacion =
    await aplicarCompensacionProveedorCancelacionCliente(
      booking,
      service,
      reembolso,
    );

  return NextResponse.json({
    ok: true,
    estado: "cancelada",
    reembolso,
    compensacion,
  });
}
