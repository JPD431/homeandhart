import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBookingPrecioBase } from "@/app/lib/ingresos-proveedor";
import { notifyBookingEvent } from "@/app/lib/notifications";
import { registrarCancelacion } from "@/app/lib/cancelaciones";
import { buscarAlternativasGarantia } from "@/app/lib/garantia";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import {
  aplicarReembolsoStripeBooking,
  calcularReembolsoTotal,
  devolverCreditoCliente,
  roundMoney,
} from "@/app/lib/stripe-reembolso";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ESTADOS_CANCELABLES = ["confirmada"];

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

/** Salvaguarda legacy: 1 PI por booking en reservas nuevas; si count > 1, solo avisar. */
function warnLegacySharedPaymentIntentCancelProveedor(
  bookingId,
  paymentIntentId,
  bookingsEnGrupo,
) {
  if (bookingsEnGrupo <= 1) return;

  console.warn(
    "[bookings/cancel-proveedor] PI compartido (legacy) — se reembolsa solo el importe de esta línea (M9)",
    {
      bookingId,
      payment_intent_id: paymentIntentId,
      bookingsEnGrupo,
    },
  );
}

/**
 * Reembolso de ESTA reserva (tarjeta de la línea), no del PI entero (M9 / F5).
 * En flujo nuevo (1 PI = 1 línea) tarjeta ≈ importe del PI.
 * En legacy compartido: solo la parte de esta línea; nunca cancela el PI entero
 * si hay otras reservas activas.
 */
async function handleStripeForCancellation(booking) {
  if (!booking?.payment_intent_id) {
    return { stripe_ok: true, stripe_action: "sin_pi" };
  }

  const { tarjeta } = calcularReembolsoTotal(booking);
  const idempotencyKey = `refund:cancel-proveedor:${booking.id}`;

  return aplicarReembolsoStripeBooking(
    stripe,
    booking.payment_intent_id,
    tarjeta,
    {
      idempotencyKey,
      supabaseAdmin,
      bookingId: booking.id,
    },
  );
}

function calcularRepartoIndemnizacion(fechaInicio, booking) {
  const base_indemnizacion = getBookingPrecioBase(booking);

  let totalRate;
  let clientRate;
  let platformRate;

  if (!fechaInicio) {
    totalRate = 0.5;
    clientRate = 0.2;
    platformRate = 0.3;
  } else {
    const start = new Date(`${fechaInicio}T12:00:00`);
    const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil > 48) {
      totalRate = 0.2;
      clientRate = 0.1;
      platformRate = 0.1;
    } else {
      totalRate = 0.5;
      clientRate = 0.2;
      platformRate = 0.3;
    }
  }

  const indemnizacion_total = roundMoney(base_indemnizacion * totalRate);
  let parte_cliente = roundMoney(base_indemnizacion * clientRate);
  let parte_plataforma = roundMoney(base_indemnizacion * platformRate);

  const sumPartes = roundMoney(parte_cliente + parte_plataforma);
  if (sumPartes !== indemnizacion_total) {
    parte_plataforma = roundMoney(indemnizacion_total - parte_cliente);
  }

  return {
    base_indemnizacion,
    indemnizacion_total,
    parte_cliente,
    parte_plataforma,
  };
}

/**
 * Deuda/penalización al proveedor (RPC ledger) + crédito indemnización al cliente (F4 RPC).
 */
async function aplicarPenalizacionProveedor(proveedorId, booking) {
  const reparto = calcularRepartoIndemnizacion(booking.fecha_inicio, booking);
  const {
    base_indemnizacion,
    indemnizacion_total,
    parte_cliente,
    parte_plataforma,
  } = reparto;

  const { data, error } = await supabaseAdmin.rpc(
    "aplicar_penalizacion_cancel_proveedor",
    {
      p_idempotency_key: `penalizacion:cancel-proveedor:${booking.id}`,
      p_booking_id: booking.id,
      p_proveedor_id: proveedorId,
      p_base_indemnizacion: base_indemnizacion,
      p_indemnizacion_total: indemnizacion_total,
      p_parte_cliente: parte_cliente,
      p_parte_plataforma: parte_plataforma,
    },
  );

  if (error) {
    throw new Error(error.message || "Error aplicando penalización");
  }

  const result = data && typeof data === "object" ? data : {};

  let credito_cliente_nuevo = null;
  if (parte_cliente > 0) {
    await devolverCreditoCliente(
      supabaseAdmin,
      booking.cliente_id,
      parte_cliente,
      "[bookings/cancel-proveedor]",
      { idempotencyKey: `credit:cancel-proveedor:${booking.id}` },
    );

    const { data: clienteProfile } = await supabaseAdmin
      .from("profiles")
      .select("credito_disponible")
      .eq("id", booking.cliente_id)
      .maybeSingle();
    credito_cliente_nuevo =
      clienteProfile?.credito_disponible != null
        ? roundMoney(clienteProfile.credito_disponible)
        : null;
  }

  return {
    base_indemnizacion: Number(result.base_indemnizacion) || base_indemnizacion,
    indemnizacion_total: Number(result.indemnizacion_total) || indemnizacion_total,
    parte_cliente: Number(result.parte_cliente) || parte_cliente,
    parte_plataforma: Number(result.parte_plataforma) || parte_plataforma,
    credito_cliente_nuevo,
    nueva_deuda:
      result.nueva_deuda != null ? Number(result.nueva_deuda) : undefined,
    cancelaciones_count: Number(result.cancelaciones_count) || 0,
    requiere_revision: result.requiere_revision === true,
    already_processed: result.already_processed === true,
  };
}

async function activarGarantiaCliente(booking, service) {
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(booking.cliente_id);

  if (authError) {
    throw new Error(authError.message);
  }

  let clienteEmail = authData?.user?.email ?? null;

  const { data: clienteProfile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido, email_contacto")
    .eq("id", booking.cliente_id)
    .maybeSingle();

  if (!clienteEmail && clienteProfile?.email_contacto) {
    clienteEmail = clienteProfile.email_contacto;
  }

  const clienteNombre =
    [clienteProfile?.nombre, clienteProfile?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim() || "Cliente";

  // In-process (sin self-fetch HTTP a /api/garantia).
  const garantiaResult = await buscarAlternativasGarantia({
    service_id: booking.service_id,
    fecha_inicio: booking.fecha_inicio,
    fecha_fin: booking.fecha_fin || booking.fecha_inicio,
    vertical: service.vertical,
    ciudad: service.ciudad,
  });

  if (!garantiaResult.ok) {
    throw new Error(garantiaResult.error || "Error al buscar alternativas");
  }

  const alternativas = garantiaResult.alternativas ?? [];

  if (clienteEmail) {
    const result = await sendPlatformEmail({
      tipo: "cancelacion_garantia",
      cliente_email: clienteEmail,
      cliente_nombre: clienteNombre,
      precio_original: booking.precio_total,
      alternativas,
    });

    const emailData = result.data ?? {};
    if (!result.ok || emailData.error) {
      throw new Error(
        emailData.error || result.error || "Error al enviar email de garantía",
      );
    }
  }

  return { num_alternativas: alternativas.length };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { bookingId } = body ?? {};

  if (!bookingId) {
    return NextResponse.json({ error: "Falta bookingId" }, { status: 400 });
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
      "id, service_id, cliente_id, payment_intent_id, estado, precio_total, precio_base, credito_aplicado, cliente_sin_comision, fecha_inicio, fecha_fin",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id, vertical, ciudad, titulo")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  if (!service || service.proveedor_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const canceladoAt = new Date().toISOString();

  // F5: claim atómico ANTES de cualquier operación de dinero.
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "cancelada_proveedor",
      cancelado_at: canceladoAt,
    })
    .eq("id", bookingId)
    .in("estado", ESTADOS_CANCELABLES)
    .select("id, estado");

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  const wonClaim = Array.isArray(claimedRows) && claimedRows.length > 0;

  if (!wonClaim) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("bookings")
      .select("id, estado")
      .eq("id", bookingId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { error: currentError.message },
        { status: 500 },
      );
    }

    if (current?.estado === "cancelada_proveedor") {
      // Ya cancelada: reanudar solo ops idempotentes (recovery tras crash post-claim).
      // Si el ledger de penalización ya existe, devolver already_processed limpio.
      const { data: existingPenalizacion } = await supabaseAdmin
        .from("proveedor_penalizaciones")
        .select(
          "indemnizacion_total, base_indemnizacion, parte_cliente, parte_plataforma, cancelaciones_count, requiere_revision",
        )
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (existingPenalizacion) {
        return NextResponse.json({
          success: true,
          already_processed: true,
          estado: "cancelada_proveedor",
          stripe_ok: true,
          penalizacion_ok: true,
          garantia_ok: true,
          num_alternativas: 0,
          indemnizacion: Number(existingPenalizacion.indemnizacion_total) || 0,
          indemnizacion_total:
            Number(existingPenalizacion.indemnizacion_total) || 0,
          base_indemnizacion:
            Number(existingPenalizacion.base_indemnizacion) || 0,
          parte_cliente: Number(existingPenalizacion.parte_cliente) || 0,
          parte_plataforma: Number(existingPenalizacion.parte_plataforma) || 0,
          cancelaciones_count:
            Number(existingPenalizacion.cancelaciones_count) || 0,
          requiere_revision: existingPenalizacion.requiere_revision === true,
        });
      }
      // Fall through: claim perdido pero money aún no aplicado → ops idempotentes.
    } else {
      return NextResponse.json(
        { error: "Solo se pueden cancelar reservas confirmadas" },
        { status: 409 },
      );
    }
  }

  let stripe_ok = true;
  let stripe_error = undefined;

  if (booking.payment_intent_id) {
    try {
      try {
        const bookingsEnGrupo = await contarBookingsPorPaymentIntent(
          booking.payment_intent_id,
        );
        warnLegacySharedPaymentIntentCancelProveedor(
          booking.id,
          booking.payment_intent_id,
          bookingsEnGrupo,
        );
      } catch (countErr) {
        console.error(
          "[bookings/cancel-proveedor] Error contando bookings del PI:",
          countErr,
          { bookingId: booking.id },
        );
      }

      const stripeResult = await handleStripeForCancellation(booking);
      stripe_ok = stripeResult.stripe_ok !== false;
      stripe_error = stripeResult.stripe_error;
    } catch (err) {
      stripe_ok = false;
      stripe_error = err?.message ?? String(err);
      console.error(
        "Error Stripe al cancelar reserva (proveedor):",
        booking.payment_intent_id,
        stripe_error,
      );
    }
  }

  try {
    await registrarCancelacion({
      bookingId,
      usuarioId: user.id,
      rolCancelador: "proveedor",
      motivo: typeof body?.motivo === "string" ? body.motivo : null,
    });
  } catch (regErr) {
    console.error(
      "[bookings/cancel-proveedor] Error registrando cancelación:",
      regErr?.message || regErr,
      { bookingId },
    );
  }

  try {
    const { error: disponibilidadError } = await supabaseAdmin
      .from("disponibilidad")
      .delete()
      .eq("booking_id", bookingId);
    if (disponibilidadError) {
      console.error(
        "[bookings/cancel-proveedor] No se pudo liberar disponibilidad:",
        disponibilidadError,
        { bookingId },
      );
    }
  } catch (dispErr) {
    console.error(
      "[bookings/cancel-proveedor] No se pudo liberar disponibilidad:",
      dispErr,
      { bookingId },
    );
  }

  let penalizacion_ok = true;
  let penalizacionData = {};

  try {
    penalizacionData = await aplicarPenalizacionProveedor(
      service.proveedor_id,
      booking,
    );
  } catch (err) {
    penalizacion_ok = false;
    console.error(
      "Error aplicando penalización/deuda al cancelar reserva (proveedor):",
      service.proveedor_id,
      bookingId,
      err?.message ?? err,
    );
  }

  let garantia_ok = true;
  let num_alternativas = 0;

  // Garantía / email / notif solo en el claim ganador (evita spam en resume).
  if (wonClaim) {
    try {
      const garantiaResult = await activarGarantiaCliente(booking, service);
      num_alternativas = garantiaResult.num_alternativas;
    } catch (err) {
      garantia_ok = false;
      console.error(
        "Error activando garantía al cancelar reserva (proveedor):",
        bookingId,
        err?.message ?? err,
      );
    }

    try {
      const finEmail = booking.fecha_fin || booking.fecha_inicio;
      const { data: proveedorProfile } = await supabaseAdmin
        .from("profiles")
        .select("nombre, apellido")
        .eq("id", service.proveedor_id)
        .maybeSingle();
      const proveedorNombre =
        [proveedorProfile?.nombre, proveedorProfile?.apellido]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined;

      console.log(
        "[bookings/cancel-proveedor] Creando notificación reserva_cancelada_proveedor",
        { bookingId, clienteId: booking.cliente_id },
      );

      const cancelNotif = await notifyBookingEvent(supabaseAdmin, {
        tipo: "reserva_cancelada_proveedor",
        bookingId,
        clienteId: booking.cliente_id,
        proveedorNombre,
        servicioTitulo: service.titulo,
        fechaInicio: booking.fecha_inicio,
        fechaFin: finEmail,
      });

      if (!cancelNotif?.ok) {
        console.error(
          "[bookings/cancel-proveedor] Notificación reserva_cancelada_proveedor NO creada:",
          cancelNotif,
        );
      }
    } catch (notifErr) {
      console.error(
        "[bookings/cancel-proveedor] Error creando notificación reserva_cancelada_proveedor:",
        notifErr,
        { bookingId },
      );
    }
  }

  return NextResponse.json({
    success: true,
    estado: "cancelada_proveedor",
    already_processed: !wonClaim,
    stripe_ok,
    penalizacion_ok,
    garantia_ok,
    num_alternativas,
    ...(stripe_error ? { stripe_error } : {}),
    ...(penalizacion_ok
      ? {
          indemnizacion: penalizacionData.indemnizacion_total,
          indemnizacion_total: penalizacionData.indemnizacion_total,
          base_indemnizacion: penalizacionData.base_indemnizacion,
          parte_cliente: penalizacionData.parte_cliente,
          parte_plataforma: penalizacionData.parte_plataforma,
          credito_cliente_nuevo: penalizacionData.credito_cliente_nuevo,
          nueva_deuda: penalizacionData.nueva_deuda,
          cancelaciones_count: penalizacionData.cancelaciones_count,
          requiere_revision: penalizacionData.requiere_revision,
        }
      : {}),
  });
}
