import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** Estados del PI en los que cancel libera la retención (previos a captura). */
const CANCELABLE_PI_STATUSES = new Set([
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "requires_payment_method",
  "processing",
]);

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
    "[bookings/cancel-proveedor] PI compartido detectado en cancel-proveedor — el cancel/refund afectará a varios bookings",
    {
      bookingId,
      payment_intent_id: paymentIntentId,
      bookingsEnGrupo,
    },
  );
}

async function handleStripeForCancellation(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const { status } = paymentIntent;

  if (CANCELABLE_PI_STATUSES.has(status)) {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return { stripe_ok: true };
  }

  if (status === "succeeded") {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
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

const PLATFORM_MULTIPLIER = 1.14;

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

function calcularRepartoIndemnizacion(fechaInicio, precioTotal) {
  const precio = Number(precioTotal) || 0;
  const base_indemnizacion = roundMoney(precio / PLATFORM_MULTIPLIER);

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

async function aplicarPenalizacionProveedor(proveedorId, booking) {
  const reparto = calcularRepartoIndemnizacion(
    booking.fecha_inicio,
    booking.precio_total,
  );
  const {
    base_indemnizacion,
    indemnizacion_total,
    parte_cliente,
    parte_plataforma,
  } = reparto;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "cancelaciones_proveedor_count, deuda_pendiente, penalizacion_valoracion, compensaciones_plataforma_acumuladas",
    )
    .eq("id", proveedorId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Perfil del proveedor no encontrado");
  }

  const { data: clienteProfile, error: clienteError } = await supabaseAdmin
    .from("profiles")
    .select("credito_disponible")
    .eq("id", booking.cliente_id)
    .single();

  if (clienteError || !clienteProfile) {
    throw new Error(clienteError?.message || "Perfil del cliente no encontrado");
  }

  const cancelacionesActuales = Number(profile.cancelaciones_proveedor_count) || 0;
  const deudaActual = Number(profile.deuda_pendiente) || 0;
  const penalizacionActual = Number(profile.penalizacion_valoracion) || 0;
  const compensacionesPlataformaActual =
    Number(profile.compensaciones_plataforma_acumuladas) || 0;
  const creditoClienteActual = Number(clienteProfile.credito_disponible) || 0;

  const cancelaciones_count = cancelacionesActuales + 1;
  const nueva_deuda = roundMoney(deudaActual + indemnizacion_total);
  const credito_cliente_nuevo = roundMoney(creditoClienteActual + parte_cliente);
  const requiere_revision = cancelaciones_count >= 3;

  const profileUpdate = {
    cancelaciones_proveedor_count: cancelaciones_count,
    deuda_pendiente: nueva_deuda,
    penalizacion_valoracion: penalizacionActual + 0.5,
    compensaciones_plataforma_acumuladas: roundMoney(
      compensacionesPlataformaActual + parte_plataforma,
    ),
  };

  if (requiere_revision) {
    profileUpdate.requiere_revision_admin = true;
  }

  const { error: updateProfileError } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", proveedorId);

  if (updateProfileError) {
    throw new Error(updateProfileError.message);
  }

  const { error: updateClienteError } = await supabaseAdmin
    .from("profiles")
    .update({ credito_disponible: credito_cliente_nuevo })
    .eq("id", booking.cliente_id);

  if (updateClienteError) {
    throw new Error(updateClienteError.message);
  }

  return {
    base_indemnizacion,
    indemnizacion_total,
    parte_cliente,
    parte_plataforma,
    credito_cliente_nuevo,
    nueva_deuda,
    cancelaciones_count,
    requiere_revision,
  };
}

async function activarGarantiaCliente(booking, service) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

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

  const garantiaRes = await fetch(`${baseUrl}/api/garantia`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: booking.service_id,
      fecha_inicio: booking.fecha_inicio,
      fecha_fin: booking.fecha_fin || booking.fecha_inicio,
      vertical: service.vertical,
      ciudad: service.ciudad,
    }),
  });

  const garantiaData = await garantiaRes.json();
  if (!garantiaRes.ok) {
    throw new Error(garantiaData.error || "Error al buscar alternativas");
  }

  const alternativas = garantiaData.alternativas ?? [];

  if (clienteEmail) {
    const emailRes = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "cancelacion_garantia",
        cliente_email: clienteEmail,
        cliente_nombre: clienteNombre,
        precio_original: booking.precio_total,
        alternativas,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok || emailData.error) {
      throw new Error(emailData.error || "Error al enviar email de garantía");
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
      "id, service_id, cliente_id, payment_intent_id, estado, precio_total, fecha_inicio, fecha_fin",
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
    .select("id, proveedor_id, vertical, ciudad")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  if (!service || service.proveedor_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (booking.estado !== "confirmada") {
    return NextResponse.json(
      { error: "Solo se pueden cancelar reservas confirmadas" },
      { status: 409 },
    );
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

      const stripeResult = await handleStripeForCancellation(
        booking.payment_intent_id,
      );
      stripe_ok = stripeResult.stripe_ok;
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

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: "cancelada_proveedor",
      cancelado_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("estado", "confirmada");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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

  return NextResponse.json({
    success: true,
    estado: "cancelada_proveedor",
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
