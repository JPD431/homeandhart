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

function calcularIndemnizacion(fechaInicio, precioTotal) {
  const precio = Number(precioTotal) || 0;
  if (!fechaInicio) {
    return Math.round(precio * 0.5 * 100) / 100;
  }

  const start = new Date(`${fechaInicio}T12:00:00`);
  const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  const rate = hoursUntil > 48 ? 0.2 : 0.5;
  return Math.round(precio * rate * 100) / 100;
}

async function aplicarPenalizacionProveedor(proveedorId, booking) {
  const indemnizacion = calcularIndemnizacion(
    booking.fecha_inicio,
    booking.precio_total,
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "cancelaciones_proveedor_count, deuda_pendiente, penalizacion_valoracion",
    )
    .eq("id", proveedorId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Perfil del proveedor no encontrado");
  }

  const cancelacionesActuales = Number(profile.cancelaciones_proveedor_count) || 0;
  const deudaActual = Number(profile.deuda_pendiente) || 0;
  const penalizacionActual = Number(profile.penalizacion_valoracion) || 0;

  const cancelaciones_count = cancelacionesActuales + 1;
  const nueva_deuda = Math.round((deudaActual + indemnizacion) * 100) / 100;
  const requiere_revision = cancelaciones_count >= 3;

  const profileUpdate = {
    cancelaciones_proveedor_count: cancelaciones_count,
    deuda_pendiente: nueva_deuda,
    penalizacion_valoracion: penalizacionActual + 0.5,
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

  return {
    indemnizacion,
    nueva_deuda,
    cancelaciones_count,
    requiere_revision,
  };
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
    .select("id, service_id, payment_intent_id, estado, precio_total, fecha_inicio")
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
    .select("id, proveedor_id")
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

  return NextResponse.json({
    success: true,
    estado: "cancelada_proveedor",
    stripe_ok,
    penalizacion_ok,
    ...(stripe_error ? { stripe_error } : {}),
    ...(penalizacion_ok
      ? {
          indemnizacion: penalizacionData.indemnizacion,
          nueva_deuda: penalizacionData.nueva_deuda,
          cancelaciones_count: penalizacionData.cancelaciones_count,
          requiere_revision: penalizacionData.requiere_revision,
        }
      : {}),
  });
}
