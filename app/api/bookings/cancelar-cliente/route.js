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
import { getProveedorFromService } from "@/app/lib/service-bookable";
import {
  aplicarReembolsoStripeBooking,
  CANCELABLE_PI_STATUSES,
  contarBookingsActivosPorPaymentIntent,
  contarBookingsPorPaymentIntent,
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";
import { notifyBookingEvent } from "@/app/lib/notifications";
import { registrarCancelacion } from "@/app/lib/cancelaciones";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ESTADOS_CANCELABLES = new Set(["pendiente", "confirmada"]);

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

  // Orden F4: primero Stripe (idempotente), luego crédito (idempotente).
  let stripe_ok = true;
  let stripe_error;

  if (reembolsoTarjeta > 0 && booking.payment_intent_id) {
    try {
      let bookingsEnGrupo = 1;
      try {
        bookingsEnGrupo = await contarBookingsPorPaymentIntent(
          supabaseAdmin,
          booking.payment_intent_id,
        );
      } catch (grupoError) {
        stripe_ok = false;
        stripe_error = grupoError.message;
        console.error(
          "[bookings/cancelar-cliente] Error contando bookings del PI:",
          grupoError,
          { bookingId: booking.id },
        );
      }

      if (stripe_ok) {
        warnLegacySharedPaymentIntent(
          booking.id,
          booking.payment_intent_id,
          bookingsEnGrupo,
        );
        const stripeResult = await aplicarReembolsoStripeBooking(
          stripe,
          booking.payment_intent_id,
          reembolsoTarjeta,
          {
            idempotencyKey: `refund:cancel-cliente:${booking.id}`,
            supabaseAdmin,
            bookingId: booking.id,
          },
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

  if (reembolsoCredito > 0) {
    try {
      await devolverCreditoCliente(
        supabaseAdmin,
        booking.cliente_id,
        reembolsoCredito,
        "[bookings/cancelar-cliente]",
        { idempotencyKey: `credit:cancel-cliente:${booking.id}` },
      );
    } catch (creditErr) {
      console.error(
        "[bookings/cancelar-cliente] Error abonando crédito:",
        creditErr?.message ?? creditErr,
        { bookingId: booking.id, reembolsoCredito },
      );
      // El claim de estado ya ganó; el reintento reutiliza la misma key de abono.
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

/** Salvaguarda legacy: 1 PI por booking en reservas nuevas; si count > 1, solo avisar. */
function warnLegacySharedPaymentIntent(bookingId, paymentIntentId, bookingsEnGrupo) {
  if (bookingsEnGrupo <= 1) return;

  console.warn(
    "[bookings/cancelar-cliente] PI compartido detectado, caso legacy — se aplica flujo individual sobre este booking",
    {
      bookingId,
      payment_intent_id: paymentIntentId,
      bookingsEnGrupo,
    },
  );
}

/**
 * Tras el reembolso: captura el tramo tarjeta no reembolsado si el PI sigue pre-captura.
 * Cierra el gap pct=0 (hoy no se capturaba → dinero colgado).
 */
async function asegurarCapturaStripeParaCompensacion(
  paymentIntentId,
  reembolsoTarjeta,
  { bookingId = null } = {},
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

    let otrosActivos = 0;
    try {
      otrosActivos = await contarBookingsActivosPorPaymentIntent(
        supabaseAdmin,
        paymentIntentId,
        { excludeBookingId: bookingId },
      );
    } catch (err) {
      console.error(
        "[bookings/cancelar-cliente] Error contando PI compartido en captura compensación:",
        err?.message ?? err,
      );
    }

    // M9: no cancelar el PI entero si otras reservas activas lo comparten.
    if (otrosActivos > 0 && reembolsoCents >= piAmountCents) {
      return {
        ok: false,
        chargeId: null,
        capturado_neto: 0,
        error:
          "PI compartido: no se puede liberar/cancelar todo el hold; otras reservas activas dependen de él.",
      };
    }

    if (reembolsoCents >= piAmountCents) {
      return { ok: true, chargeId: null, capturado_neto: 0 };
    }

    const amountToCapture = piAmountCents - reembolsoCents;
    if (amountToCapture <= 0) {
      if (otrosActivos > 0) {
        return {
          ok: false,
          chargeId: null,
          capturado_neto: 0,
          error:
            "PI compartido: cancel del hold bloqueado (otras reservas activas).",
        };
      }
      await stripe.paymentIntents.cancel(paymentIntentId);
      return { ok: true, chargeId: null, capturado_neto: 0 };
    }

    const captured = await stripe.paymentIntents.capture(
      paymentIntentId,
      {
        amount_to_capture: amountToCapture,
      },
      { idempotencyKey: `capture:cancel-cliente-comp:${paymentIntentId}:${amountToCapture}` },
    );

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
      supabaseAdmin,
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

  warnLegacySharedPaymentIntent(
    booking.id,
    booking.payment_intent_id,
    bookingsEnGrupo,
  );

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
        { bookingId: booking.id },
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
    idempotencyKey: `transfer:cancel-cliente:${booking.id}`,
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

async function enviarEmailReservaCanceladaCliente(booking, service, reembolso) {
  if (!service) return;

  const proveedor = getProveedorFromService(service);
  const proveedorNombre =
    [proveedor?.nombre, proveedor?.apellido].filter(Boolean).join(" ").trim() ||
    undefined;
  const precioTotal = Number(booking.precio_total) || 0;
  const reembolsoBruto = Number(reembolso.bruto) || 0;

  try {
    const result = await sendPlatformEmail({
      tipo: "reserva_cancelada_cliente",
      cliente_id: booking.cliente_id,
      servicio_titulo: service.titulo || "Servicio Home&Heart",
      proveedor_nombre: proveedorNombre,
      fecha_inicio: booking.fecha_inicio,
      fecha_fin: booking.fecha_fin,
      precio_total: precioTotal,
      credito_aplicado: Number(booking.credito_aplicado) || 0,
      pct: reembolso.pct,
      reembolso_total: reembolsoBruto,
      reembolso_tarjeta: Number(reembolso.tarjeta) || 0,
      reembolso_credito: Number(reembolso.credito) || 0,
      importe_final: roundMoney(precioTotal - reembolsoBruto),
    });

    if (!result.ok) {
      console.error(
        "[bookings/cancelar-cliente] Error enviando email reserva_cancelada_cliente:",
        result.error || result.status,
        { bookingId: booking.id },
      );
    }
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] Error enviando email reserva_cancelada_cliente:",
      err,
      { bookingId: booking.id },
    );
  }
}

/** Persiste el desglose de reembolso al cliente (historial). */
async function guardarReembolsoClienteEnBooking(bookingId, reembolso) {
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      reembolso_cliente_pct: reembolso.pct,
      reembolso_cliente_total: roundMoney(reembolso.bruto),
      reembolso_cliente_credito: roundMoney(reembolso.credito),
    })
    .eq("id", bookingId);

  if (error) {
    console.error(
      "[bookings/cancelar-cliente] No se pudo guardar reembolso_cliente en booking:",
      error,
      { bookingId },
    );
  }
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
      reembolso_cliente_pct,
      reembolso_cliente_total,
      reembolso_cliente_credito,
      services:service_id (
        titulo,
        vertical,
        ciudad,
        cancellation_policy,
        proveedor_id,
        profiles!proveedor_id (
          nombre,
          apellido
        )
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

  const service = booking.services;
  const canceladoAt = new Date().toISOString();

  // F4: claim atómico — solo la primera petición pasa a refund/crédito.
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "cancelada",
      cancelado_at: canceladoAt,
    })
    .eq("id", bookingId)
    .in("estado", [...ESTADOS_CANCELABLES])
    .select(
      "id, estado, cancelado_at, reembolso_cliente_pct, reembolso_cliente_total, reembolso_cliente_credito",
    );

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  const wonClaim = Array.isArray(claimedRows) && claimedRows.length > 0;

  if (!wonClaim) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, estado, reembolso_cliente_pct, reembolso_cliente_total, reembolso_cliente_credito, compensacion_cancelacion",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { error: currentError.message },
        { status: 500 },
      );
    }

    if (current?.estado === "cancelada") {
      // Ya cancelada: si el reembolso quedó persistido, no repetir side-effects.
      if (current.reembolso_cliente_pct != null) {
        return NextResponse.json({
          ok: true,
          already_processed: true,
          estado: "cancelada",
          reembolso: {
            pct: Number(current.reembolso_cliente_pct) || 0,
            bruto: Number(current.reembolso_cliente_total) || 0,
            credito: Number(current.reembolso_cliente_credito) || 0,
            tarjeta: roundMoney(
              (Number(current.reembolso_cliente_total) || 0) -
                (Number(current.reembolso_cliente_credito) || 0),
            ),
            stripe_ok: true,
          },
          compensacion: {
            aplicada: current.compensacion_cancelacion != null,
            skipped: true,
            motivo: "ya_procesada",
            compensacion_cancelacion:
              current.compensacion_cancelacion != null
                ? Number(current.compensacion_cancelacion)
                : null,
          },
        });
      }

      // Claim ganado por otra petición que aún no persistió reembolso:
      // reanudar con ops idempotentes (refund/credit keys) sin volver a claim.
    } else {
      return NextResponse.json(
        { error: "Esta reserva no se puede cancelar" },
        { status: 409 },
      );
    }
  }

  try {
    await registrarCancelacion({
      bookingId,
      usuarioId: user.id,
      rolCancelador: "cliente",
      motivo: typeof body?.motivo === "string" ? body.motivo : null,
    });
  } catch (regErr) {
    console.error(
      "[bookings/cancelar-cliente] Error registrando cancelación:",
      regErr?.message || regErr,
      { bookingId },
    );
  }

  await liberarFechasReserva(bookingId);

  const reembolso = await calcularYAplicarReembolso(booking, service);

  await guardarReembolsoClienteEnBooking(bookingId, reembolso);

  const compensacion =
    await aplicarCompensacionProveedorCancelacionCliente(
      booking,
      service,
      reembolso,
    );

  // Email/notif solo en el claim ganador (evita spam en reanudación concurrente).
  if (wonClaim) {
    await enviarEmailReservaCanceladaCliente(booking, service, reembolso);

    try {
      const proveedor = getProveedorFromService(service);
      const proveedorId = service?.proveedor_id;
      const { data: clienteProfile } = await supabaseAdmin
        .from("profiles")
        .select("nombre, apellido")
        .eq("id", booking.cliente_id)
        .maybeSingle();
      const clienteNombre =
        [clienteProfile?.nombre, clienteProfile?.apellido]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined;
      const finEmail = booking.fecha_fin || booking.fecha_inicio;

      console.log(
        "[bookings/cancelar-cliente] Creando notificación reserva_cancelada_cliente",
        { bookingId, proveedorId },
      );

      const cancelNotif = await notifyBookingEvent(supabaseAdmin, {
        tipo: "reserva_cancelada_cliente",
        bookingId,
        proveedorId,
        clienteNombre,
        proveedorNombre:
          [proveedor?.nombre, proveedor?.apellido].filter(Boolean).join(" ") ||
          undefined,
        servicioTitulo: service?.titulo,
        fechaInicio: booking.fecha_inicio,
        fechaFin: finEmail,
      });

      if (!cancelNotif?.ok) {
        console.error(
          "[bookings/cancelar-cliente] Notificación reserva_cancelada_cliente NO creada:",
          cancelNotif,
        );
      }
    } catch (notifErr) {
      console.error(
        "[bookings/cancelar-cliente] Error creando notificación reserva_cancelada_cliente:",
        notifErr,
        { bookingId },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    estado: "cancelada",
    already_processed: !wonClaim,
    reembolso,
    compensacion,
  });
}
