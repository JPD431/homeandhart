import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHoyDateStr } from "@/app/lib/ofertas";
import {
  applyClientPrice,
  calculateServiceBasePrice,
  COMMISSION_RATE,
} from "@/app/lib/pricing-reserva";

const MAX_CREDITO_PORCENTAJE = 0.6;

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SERVICE_SELECT = `
  id,
  precio,
  vertical,
  oferta_descuento,
  oferta_valida_hasta,
  descuentos_duracion,
  estancia_minima,
  estancia_maxima,
  antelacion_minima,
  dias_disponibles,
  disponible,
  reserva_inmediata,
  proveedor_id,
  titulo,
  profiles_public (
    verificado
  )
`;

function isServiceBookable(service) {
  return (
    service?.disponible === true && service?.profiles_public?.verificado === true
  );
}

function getPrecioEspecialOverride(precioEspecial, validaHasta) {
  const precio = Number(precioEspecial);
  if (!precio || precio <= 0 || !validaHasta) return null;
  if (validaHasta < getHoyDateStr()) return null;
  return precio;
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function buildBookingRow({
  svc,
  userId,
  fechaInicio,
  fechaFin,
  hora,
  duracionHoras,
  mensaje,
  precioTotal,
  grupoReserva,
  paymentIntentId,
  familiaId,
}) {
  const v = svc.vertical;
  const isImmediate = svc.reserva_inmediata === true;

  return {
    cliente_id: userId,
    service_id: svc.id,
    fecha_inicio: fechaInicio || null,
    fecha_fin:
      v === "alojamiento" || v === "mascotas"
        ? fechaFin || fechaInicio || null
        : null,
    hora: v === "ninos" ? hora || null : null,
    duracion_horas: v === "ninos" ? Number(duracionHoras) || null : null,
    mensaje: mensaje?.trim() || null,
    precio_total: precioTotal,
    estado: isImmediate ? "confirmada" : "pendiente",
    grupo_reserva: grupoReserva,
    payment_intent_id: paymentIntentId,
    familia_id: familiaId || null,
  };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userId = user.id;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const {
      payment_intent_id,
      grupo_reserva,
      main_service_id,
      service_ids,
      fecha_inicio = null,
      fecha_fin = null,
      hora = null,
      duracion_horas = null,
      mensaje = null,
      familia_id = null,
      precio_especial = null,
      valida_hasta = null,
    } = body ?? {};

    if (!payment_intent_id || typeof payment_intent_id !== "string") {
      return NextResponse.json(
        { error: "Falta payment_intent_id" },
        { status: 400 },
      );
    }
    if (!grupo_reserva || typeof grupo_reserva !== "string") {
      return NextResponse.json(
        { error: "Falta grupo_reserva" },
        { status: 400 },
      );
    }
    if (!main_service_id || typeof main_service_id !== "string") {
      return NextResponse.json(
        { error: "Falta main_service_id" },
        { status: 400 },
      );
    }
    if (!Array.isArray(service_ids) || service_ids.length === 0) {
      return NextResponse.json(
        { error: "Falta service_ids (debe ser un array no vacío)" },
        { status: 400 },
      );
    }

    const uniqueServiceIds = [...new Set(service_ids)];

    const { data: services, error: servicesError } = await supabaseAdmin
      .from("services")
      .select(SERVICE_SELECT)
      .in("id", uniqueServiceIds);

    if (servicesError) {
      return NextResponse.json(
        { error: servicesError.message },
        { status: 500 },
      );
    }

    if (!services || services.length !== uniqueServiceIds.length) {
      const foundIds = new Set(services?.map((s) => s.id) ?? []);
      const missing = uniqueServiceIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: "Algunos servicios no existen", missing_service_ids: missing },
        { status: 400 },
      );
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const mainService = serviceMap.get(main_service_id);
    if (!mainService) {
      return NextResponse.json(
        { error: "main_service_id no está en service_ids" },
        { status: 400 },
      );
    }

    if (!services.every(isServiceBookable)) {
      return NextResponse.json(
        { error: "Algún servicio ya no está disponible" },
        { status: 409 },
      );
    }

    const { data: perfilCliente, error: perfilError } = await supabaseAdmin
      .from("profiles")
      .select("reservas_sin_comision, credito_disponible")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 500 });
    }

    const mainVertical = mainService.vertical;
    const dateContext = {
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      duracionHoras: duracion_horas,
      mainVertical,
    };

    const precioEspecialOverride = getPrecioEspecialOverride(
      precio_especial,
      valida_hasta,
    );

    const clienteSinComision =
      (Number(perfilCliente?.reservas_sin_comision) || 0) > 0;

    const preciosPorServicio = [];
    let subtotalGrupo = 0;

    for (const serviceId of service_ids) {
      const svc = serviceMap.get(serviceId);
      const unitOverride =
        serviceId === main_service_id ? precioEspecialOverride : null;

      const calc = calculateServiceBasePrice(svc, dateContext, unitOverride);

      if (!calc.ready) {
        return NextResponse.json(
          {
            error: "No se pudo calcular el precio",
            service_id: serviceId,
            detail: calc.detail,
          },
          { status: 400 },
        );
      }

      subtotalGrupo += calc.base;

      const precioTotal = clienteSinComision
        ? calc.base
        : applyClientPrice(calc.base);

      preciosPorServicio.push({
        service_id: serviceId,
        precio_total: roundMoney(precioTotal),
      });
    }

    subtotalGrupo = roundMoney(subtotalGrupo);
    const comision = clienteSinComision
      ? 0
      : roundMoney(subtotalGrupo * COMMISSION_RATE);
    const totalGrupo = roundMoney(subtotalGrupo + comision);

    const creditoDisponible = Number(perfilCliente?.credito_disponible) || 0;
    const topeCredito = roundMoney(totalGrupo * MAX_CREDITO_PORCENTAJE);
    const creditoAplicado = Math.min(creditoDisponible, topeCredito);
    const totalAPagar = roundMoney(totalGrupo - creditoAplicado);

    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment_intent_id,
    );

    if (paymentIntent.metadata?.cliente_id !== userId) {
      return NextResponse.json(
        { error: "El pago no pertenece a este usuario" },
        { status: 403 },
      );
    }

    if (paymentIntent.metadata?.grupo_reserva !== grupo_reserva) {
      return NextResponse.json(
        { error: "grupo_reserva no coincide con el pago" },
        { status: 400 },
      );
    }

    const validStatuses = ["requires_capture", "succeeded"];
    if (!validStatuses.includes(paymentIntent.status)) {
      return NextResponse.json(
        { error: "El pago no está confirmado" },
        { status: 400 },
      );
    }

    const expectedAmountCents = Math.round(totalAPagar * 100);
    const amountDiff = Math.abs(paymentIntent.amount - expectedAmountCents);
    if (amountDiff > 2) {
      return NextResponse.json(
        { error: "El importe del pago no coincide" },
        { status: 400 },
      );
    }

    if (familia_id) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("familia_miembros")
        .select("id")
        .eq("perfil_id", userId)
        .eq("familia_id", familia_id)
        .eq("estado", "activo")
        .maybeSingle();

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 500 },
        );
      }

      if (!membership) {
        return NextResponse.json(
          { error: "No perteneces a esa familia" },
          { status: 403 },
        );
      }
    }

    const { data: existingBookings, error: existingError } = await supabaseAdmin
      .from("bookings")
      .select("id, service_id")
      .eq("payment_intent_id", payment_intent_id);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }

    if (existingBookings?.length > 0) {
      return NextResponse.json({
        ok: true,
        already_created: true,
        booking_ids: existingBookings.map((b) => b.id),
      });
    }

    const precioPorServicioMap = new Map(
      preciosPorServicio.map((p) => [p.service_id, p.precio_total]),
    );

    const bookingRows = service_ids.map((serviceId) => {
      const svc = serviceMap.get(serviceId);
      return buildBookingRow({
        svc,
        userId,
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
        hora,
        duracionHoras: duracion_horas,
        mensaje,
        precioTotal: precioPorServicioMap.get(serviceId),
        grupoReserva: grupo_reserva,
        paymentIntentId: payment_intent_id,
        familiaId: familia_id,
      });
    });

    const { data: insertedBookings, error: insertError } = await supabaseAdmin
      .from("bookings")
      .insert(bookingRows)
      .select("id, service_id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const finDisponibilidad = fecha_fin || fecha_inicio;
    const { error: disponibilidadError } = await supabaseAdmin
      .from("disponibilidad")
      .insert(
        insertedBookings.map((booking) => ({
          service_id: booking.service_id,
          fecha_inicio: fecha_inicio,
          fecha_fin: finDisponibilidad,
          booking_id: booking.id,
        })),
      );

    if (disponibilidadError) {
      console.error(
        "[bookings/complete] No se pudo bloquear disponibilidad tras crear bookings:",
        disponibilidadError,
        {
          payment_intent_id,
          booking_ids: insertedBookings.map((b) => b.id),
        },
      );
    }

    return NextResponse.json({
      ok: true,
      booking_ids: insertedBookings.map((b) => b.id),
      grupo_reserva,
    });
  } catch (error) {
    console.error("[bookings/complete]", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 },
    );
  }
}
