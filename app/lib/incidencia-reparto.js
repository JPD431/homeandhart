import Stripe from "stripe";
import { capturarRepartoIncidencia } from "@/app/lib/capturar-y-transferir";
import {
  calcularBoteRepartoIncidencia,
  desglosarDevolucionCliente,
  esReembolsoTotalPorReparto,
  validarRepartoImportes,
} from "@/app/lib/incidencia-reparto-bote";
import { ejecutarTransferProveedorConDeudaSaldo } from "@/app/lib/transfer-proveedor";
import {
  aplicarReembolsoStripeBooking,
  CANCELABLE_PI_STATUSES,
  contarBookingsPorPaymentIntent,
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const LOG_PREFIX = "[reparto]";

export function idempotencyKeyRepartoIncidencia(bookingId) {
  return `incidencia-reparto-${bookingId}`;
}

export { calcularBoteRepartoIncidencia, validarRepartoImportes };

async function devolverCreditoRepartoIdempotente(
  supabaseAdmin,
  booking,
  creditoADevolver,
) {
  if (!creditoADevolver || creditoADevolver <= 0) {
    return { credito_devuelto: 0, skipped: true, reason: "sin_credito" };
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from("bookings")
    .select("reembolso_cliente_credito, resolucion_tipo")
    .eq("id", booking.id)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (
    existing?.reembolso_cliente_credito != null &&
    existing?.resolucion_tipo === "reparto"
  ) {
    return {
      credito_devuelto: 0,
      skipped: true,
      reason: "ya_registrado",
    };
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({
      reembolso_cliente_credito: creditoADevolver,
    })
    .eq("id", booking.id)
    .is("reembolso_cliente_credito", null)
    .select("id");

  if (claimError) {
    throw claimError;
  }

  if (!claimed?.length) {
    return { credito_devuelto: 0, skipped: true, reason: "claim_sin_filas" };
  }

  await devolverCreditoCliente(
    supabaseAdmin,
    booking.cliente_id,
    creditoADevolver,
    LOG_PREFIX,
  );

  return { credito_devuelto: creditoADevolver, skipped: false };
}

async function transferirProveedorRepartoSucceeded(
  supabaseAdmin,
  booking,
  importeProveedor,
  chargeId,
  creditoAplicado,
) {
  if (importeProveedor <= 0) {
    return { success: true, skipped: true };
  }

  const existingTransfer = roundMoney(Number(booking.importe_transferido) || 0);
  if (booking.pago_liberado_at && existingTransfer >= importeProveedor - 0.01) {
    return { success: true, already_transferred: true };
  }

  if (existingTransfer > importeProveedor + 0.01) {
    return {
      success: false,
      error:
        "Ya se transfirió más al proveedor de lo acordado en este reparto. Gestión manual necesaria.",
    };
  }

  const { data: service } = await supabaseAdmin
    .from("services")
    .select(
      `
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id,
        deuda_pendiente,
        saldo_pendiente_transferir,
        cobros_activos
      )
    `,
    )
    .eq("id", booking.service_id)
    .maybeSingle();

  if (!service?.proveedor_id) {
    return { success: false, error: "Proveedor no encontrado" };
  }

  const transferSummary = await ejecutarTransferProveedorConDeudaSaldo({
    stripe,
    supabase: supabaseAdmin,
    proveedorId: service.proveedor_id,
    stripeAccountId: service.profiles?.stripe_account_id,
    profile: service.profiles,
    amountBruto: importeProveedor,
    chargeId,
    usePlatformBalance: creditoAplicado > 0,
    logPrefix: LOG_PREFIX,
  });

  if (!transferSummary.success) {
    return {
      success: false,
      error: transferSummary.error || "Error al transferir al proveedor.",
      transfer: transferSummary,
    };
  }

  return { success: true, transfer: transferSummary };
}

async function ejecutarStripeRepartoIncidencia(
  supabaseAdmin,
  booking,
  boteInfo,
  importeCliente,
  importeProveedor,
  idempotencyKey,
) {
  if (!booking.payment_intent_id) {
    return { stripe_ok: true, stripe_action: "sin_pi" };
  }

  const { tarjeta: tarjetaCliente, credito: creditoCliente } =
    desglosarDevolucionCliente(importeCliente, boteInfo.credito_aplicado);

  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
  } catch (err) {
    return {
      stripe_ok: false,
      stripe_error: err?.message ?? String(err),
    };
  }

  const piStatus = pi.status;

  console.error(`${LOG_PREFIX} stripe-antes`, {
    bookingId: booking.id,
    pi_status: piStatus,
    importe_cliente: importeCliente,
    importe_proveedor: importeProveedor,
    tarjeta_cliente: tarjetaCliente,
    credito_cliente: creditoCliente,
    bote: boteInfo.bote,
  });

  if (piStatus === "canceled") {
    return {
      stripe_ok: false,
      stripe_error: "El pago ya está liberado al cliente, no se puede repartir.",
      pi_status: piStatus,
    };
  }

  if (booking.pago_liberado_at && booking.resolucion_tipo === "reparto") {
    return {
      stripe_ok: true,
      stripe_action: "already_processed",
      pi_status: piStatus,
    };
  }

  if (CANCELABLE_PI_STATUSES.has(piStatus)) {
    const capture = await capturarRepartoIncidencia(
      supabaseAdmin,
      booking.payment_intent_id,
      {
        bookingId: booking.id,
        serviceId: booking.service_id,
        importeProveedor,
        importeTarjeta: boteInfo.importe_tarjeta,
        tarjetaCliente,
        comisionHHTotal: boteInfo.comision_hh_total,
        creditoAplicado: boteInfo.credito_aplicado,
        logPrefix: LOG_PREFIX,
      },
      { idempotencyKey: `${idempotencyKey}-capture` },
    );

    console.error(`${LOG_PREFIX} stripe-despues`, {
      bookingId: booking.id,
      ok: capture.success,
      stripe_action: capture.stripe_action,
      amount_captured_cents: capture.amount_captured_cents,
    });

    if (capture.success || capture.already_processed) {
      return {
        stripe_ok: true,
        stripe_action: capture.stripe_action || "already_processed",
        pi_status: piStatus,
        capture,
        tarjeta_cliente: tarjetaCliente,
        credito_cliente: creditoCliente,
      };
    }

    return {
      stripe_ok: false,
      stripe_error: capture.error || "Error en captura parcial de reparto.",
      pi_status: piStatus,
      capture,
    };
  }

  if (piStatus === "succeeded") {
    let stripeResult = {
      stripe_ok: true,
      stripe_action: "succeeded",
      pi_status: piStatus,
      tarjeta_cliente: tarjetaCliente,
      credito_cliente: creditoCliente,
    };

    if (tarjetaCliente > 0) {
      try {
        const refundResult = await aplicarReembolsoStripeBooking(
          stripe,
          booking.payment_intent_id,
          tarjetaCliente,
          { idempotencyKey: `${idempotencyKey}-refund` },
        );
        stripeResult = { ...stripeResult, refund: refundResult };
        if (!refundResult.stripe_ok) {
          return {
            stripe_ok: false,
            stripe_error:
              refundResult.stripe_error || "Error al reembolsar al cliente.",
            pi_status: piStatus,
            refund: refundResult,
          };
        }
        stripeResult.stripe_action = refundResult.stripe_action;
      } catch (err) {
        return {
          stripe_ok: false,
          stripe_error: err?.message ?? String(err),
          pi_status: piStatus,
        };
      }
    }

    const chargeId =
      typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;

    const transferResult = await transferirProveedorRepartoSucceeded(
      supabaseAdmin,
      booking,
      importeProveedor,
      chargeId,
      boteInfo.credito_aplicado,
    );

    if (!transferResult.success) {
      return {
        stripe_ok: false,
        stripe_error: transferResult.error,
        pi_status: piStatus,
        transfer: transferResult,
      };
    }

    if (importeProveedor > 0 && !booking.pago_liberado_at) {
      const liberadoAt = new Date().toISOString();
      await supabaseAdmin
        .from("bookings")
        .update({
          pago_liberado_at: liberadoAt,
          importe_transferido: roundMoney(importeProveedor),
        })
        .eq("id", booking.id);
    }

    return {
      ...stripeResult,
      stripe_ok: true,
      transfer: transferResult,
    };
  }

  return {
    stripe_ok: false,
    stripe_error: `Estado del PaymentIntent no manejado para reparto: ${piStatus}`,
    pi_status: piStatus,
  };
}

export async function ejecutarRepartoIncidencia(
  supabaseAdmin,
  booking,
  adminId,
  importeCliente,
  importeProveedor,
  nota,
) {
  if (booking.estado === "incidencia_resuelta") {
    if (booking.resolucion_tipo === "reparto") {
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

  const boteInfo = calcularBoteRepartoIncidencia(booking);
  const validacion = validarRepartoImportes(
    boteInfo.bote,
    importeCliente,
    importeProveedor,
  );

  if (!validacion.ok) {
    return {
      success: false,
      status: 400,
      step: "validate_importes",
      error: validacion.error,
      bote: boteInfo,
    };
  }

  const ic = validacion.importe_cliente;
  const ip = validacion.importe_proveedor;

  if (ic >= roundMoney(boteInfo.precio_total - 0.01)) {
    return {
      success: false,
      status: 400,
      step: "validate_importes",
      error:
        "Para devolver el importe total al cliente, usa «Reembolsar todo al cliente».",
      bote: boteInfo,
    };
  }

  if (esReembolsoTotalPorReparto(boteInfo, ic, ip)) {
    return {
      success: false,
      status: 400,
      step: "validate_importes",
      error:
        "Este reparto equivale a un reembolso total (captura 0 €). Usa «Reembolsar todo al cliente».",
      bote: boteInfo,
    };
  }

  let bookingsEnGrupo = 1;
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

    if (bookingsEnGrupo > 1) {
      return {
        success: false,
        status: 409,
        step: "bundle",
        error:
          "PaymentIntent compartido (bundle): el reparto de un solo servicio requiere gestión manual.",
        is_bundle: true,
      };
    }
  }

  const idempotencyKey = idempotencyKeyRepartoIncidencia(booking.id);

  const stripeResult = await ejecutarStripeRepartoIncidencia(
    supabaseAdmin,
    booking,
    boteInfo,
    ic,
    ip,
    idempotencyKey,
  );

  if (!stripeResult.stripe_ok) {
    return {
      success: false,
      status: stripeResult.is_bundle ? 409 : 502,
      step: "stripe",
      error: stripeResult.stripe_error,
      stripe: stripeResult,
      bote: boteInfo,
    };
  }

  const { credito: creditoCliente } = desglosarDevolucionCliente(
    ic,
    boteInfo.credito_aplicado,
  );

  let creditoResult = { credito_devuelto: 0, skipped: true };
  try {
    creditoResult = await devolverCreditoRepartoIdempotente(
      supabaseAdmin,
      booking,
      creditoCliente,
    );
  } catch (creditoErr) {
    return {
      success: false,
      status: 500,
      step: "credito",
      error: creditoErr?.message ?? String(creditoErr),
      stripe: stripeResult,
      bote: boteInfo,
    };
  }

  const resolucionAt = new Date().toISOString();

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "incidencia_resuelta",
      resolucion_tipo: "reparto",
      resolucion_at: resolucionAt,
      resolucion_admin_id: adminId,
      resolucion_nota: nota?.trim() || null,
      resolucion_importe_cliente: ic,
      resolucion_importe_proveedor: ip,
      confirmacion_cliente: "ok",
      confirmado_at: resolucionAt,
      ...(booking.pago_liberado_at ? {} : { pago_liberado_at: resolucionAt }),
    })
    .eq("id", booking.id)
    .eq("estado", "incidencia")
    .select("id");

  if (updateError) {
    return {
      success: false,
      status: 500,
      step: "db_update",
      error: updateError.message,
      stripe: stripeResult,
      bote: boteInfo,
    };
  }

  if (!updatedRows?.length) {
    const { data: current } = await supabaseAdmin
      .from("bookings")
      .select("estado, resolucion_tipo, resolucion_at")
      .eq("id", booking.id)
      .maybeSingle();

    if (current?.estado === "incidencia_resuelta" && current?.resolucion_tipo === "reparto") {
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

  console.error(`${LOG_PREFIX} success`, {
    bookingId: booking.id,
    importe_cliente: ic,
    importe_proveedor: ip,
    bote: boteInfo.bote,
  });

  return {
    success: true,
    booking_id: booking.id,
    estado: "incidencia_resuelta",
    resolucion_tipo: "reparto",
    resolucion_at: resolucionAt,
    importe_cliente: ic,
    importe_proveedor: ip,
    bote: boteInfo,
    stripe: stripeResult,
    credito: creditoResult,
  };
}

export async function enviarEmailsRepartoIncidencia(
  booking,
  service,
  importeCliente,
  importeProveedor,
  boteInfo,
) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, emails omitidos");
    return;
  }

  const proveedor = service?.profiles_public ?? service?.profiles;
  const proveedorNombre =
    [proveedor?.nombre, proveedor?.apellido].filter(Boolean).join(" ").trim() || undefined;

  const { credito, tarjeta } = desglosarDevolucionCliente(
    importeCliente,
    boteInfo?.credito_aplicado ?? booking.credito_aplicado ?? 0,
  );

  if (importeCliente > 0) {
    try {
      await fetch(`${baseUrl}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "incidencia_reembolso_cliente",
          cliente_id: booking.cliente_id,
          servicio_titulo: service?.titulo || "Servicio Home&Heart",
          reembolso_total: roundMoney(importeCliente),
          reembolso_tarjeta: roundMoney(tarjeta),
          reembolso_credito: roundMoney(credito),
        }),
      });
    } catch (err) {
      console.error(LOG_PREFIX, "email cliente error:", err);
    }
  }

  if (importeProveedor > 0) {
    try {
      await fetch(`${baseUrl}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "incidencia_liberado_proveedor",
          proveedor_id: service?.proveedor_id,
          proveedor_nombre: proveedorNombre,
          servicio_titulo: service?.titulo || "Servicio Home&Heart",
          importe_proveedor: roundMoney(importeProveedor),
          booking_id: booking.id,
        }),
      });
    } catch (err) {
      console.error(LOG_PREFIX, "email proveedor error:", err);
    }
  }
}
