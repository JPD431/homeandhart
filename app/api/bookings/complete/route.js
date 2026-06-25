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
import { cargarTarifasPorServicios } from "@/app/lib/tarifas";
import {
  COBROS_INACTIVE_MSG,
  getProveedorFromService,
} from "@/app/lib/service-bookable";
import { rewardReferidorPrimeraReserva } from "@/app/lib/referidos";

const MAX_CREDITO_PORCENTAJE = 0.6;

function getReservasSinComisionCliente(perfil) {
  if (perfil?.reservas_sin_comision_cliente != null) {
    return Number(perfil.reservas_sin_comision_cliente) || 0;
  }
  return Number(perfil?.reservas_sin_comision) || 0;
}

function getReservasSinComisionProveedor(perfil) {
  if (perfil?.reservas_sin_comision_proveedor != null) {
    return Number(perfil.reservas_sin_comision_proveedor) || 0;
  }
  return Number(perfil?.reservas_sin_comision) || 0;
}

function buildProveedorIngresoEmailFields(booking, proveedorProfile) {
  const precioTotal = Number(booking.precio_total || 0);

  return {
    precio_base: booking.precio_base,
    precio_total: precioTotal.toFixed(2),
    cliente_sin_comision: booking.cliente_sin_comision === true,
    proveedor_sin_comision: booking.proveedor_sin_comision === true,
    sinComisionProveedor: getReservasSinComisionProveedor(proveedorProfile) > 0,
  };
}

async function decrementReservasSinComisionCliente(userId, perfilCliente) {
  const actual = getReservasSinComisionCliente(perfilCliente);
  const nuevo = Math.max(0, actual - 1);
  const { error: sinComisionError } = await supabaseAdmin
    .from("profiles")
    .update({
      reservas_sin_comision_cliente: nuevo,
      reservas_sin_comision: nuevo,
    })
    .eq("id", userId);

  if (sinComisionError) {
    console.error(
      "[bookings/complete] No se pudo restar reservas_sin_comision_cliente:",
      sinComisionError,
    );
  }
}

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
  direccion_exacta,
  telefono_contacto,
  modalidad,
  profiles!proveedor_id (
    nombre,
    verificado,
    cobros_activos
  )
`;

function validateServicesBookable(services) {
  for (const service of services) {
    const proveedor = getProveedorFromService(service);
    if (service?.disponible !== true || proveedor?.verificado !== true) {
      return { ok: false, error: "Algún servicio ya no está disponible" };
    }
    if (proveedor?.cobros_activos !== true) {
      return { ok: false, error: COBROS_INACTIVE_MSG };
    }
  }
  return { ok: true };
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

function buildServicePricing(calcBase, clienteSinComision) {
  const precioBase = roundMoney(calcBase);
  const precioTotal = clienteSinComision
    ? precioBase
    : applyClientPrice(precioBase);

  return {
    precio_base: precioBase,
    precio_total: roundMoney(precioTotal),
  };
}

/** Reparte creditoAplicado del grupo entre servicios según precio_total. */
function splitCreditoPorServicio(preciosPorServicio, creditoAplicado, totalGrupo) {
  const creditoMap = new Map();

  if (!creditoAplicado || creditoAplicado <= 0 || !preciosPorServicio.length) {
    for (const { service_id } of preciosPorServicio) {
      creditoMap.set(service_id, 0);
    }
    return creditoMap;
  }

  let assigned = 0;

  for (let i = 0; i < preciosPorServicio.length; i++) {
    const { service_id, precio_total } = preciosPorServicio[i];

    if (i === preciosPorServicio.length - 1) {
      creditoMap.set(service_id, roundMoney(creditoAplicado - assigned));
    } else {
      const share = roundMoney(
        creditoAplicado * (precio_total / totalGrupo),
      );
      creditoMap.set(service_id, share);
      assigned += share;
    }
  }

  return creditoMap;
}

function isDisponibilidadExclusionError(error) {
  if (!error) return false;
  if (error.code === "23P01") return true;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return text.includes("disponibilidad_sin_solapamiento");
}

async function hasDisponibilidadSolapamiento(serviceId, fechaInicio, fechaFin) {
  const fin = fechaFin || fechaInicio;
  const { data, error } = await supabaseAdmin
    .from("disponibilidad")
    .select("id")
    .eq("service_id", serviceId)
    .lte("fecha_inicio", fin)
    .gte("fecha_fin", fechaInicio)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function rollbackInsertedBookings(bookingIds, paymentIntentId) {
  const { error } = await supabaseAdmin
    .from("bookings")
    .delete()
    .in("id", bookingIds);

  if (error) {
    console.error(
      "[bookings/complete] Fallo al revertir bookings tras conflicto de disponibilidad:",
      error,
      { payment_intent_id: paymentIntentId, booking_ids: bookingIds },
    );
  }
}

async function sendBookingEmail(payload) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    console.error(
      "[bookings/complete] NEXT_PUBLIC_URL no configurada, email omitido:",
      payload.tipo,
    );
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(
        "[bookings/complete] Error enviando email:",
        payload.tipo,
        data.error || res.status,
      );
    }
  } catch (err) {
    console.error("[bookings/complete] Error enviando email:", payload.tipo, err);
  }
}

function formatProfileName(profile, fallback = "Usuario") {
  const name = [profile?.nombre, profile?.apellido].filter(Boolean).join(" ");
  return name || fallback;
}

function resolveTelefonoProveedor(svc, proveedorProfile) {
  return svc.telefono_contacto || proveedorProfile?.telefono || undefined;
}

async function loadClienteProfileForEmails(userId, perfilCliente) {
  if (perfilCliente?.telefono) {
    return perfilCliente;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido, telefono")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[bookings/complete] Error cargando perfil cliente para emails:",
      error,
    );
    return perfilCliente ?? data;
  }

  return { ...perfilCliente, ...data };
}

async function sendContactEmailsForConfirmedBooking(
  booking,
  svc,
  clienteProfile,
  proveedorProfile,
) {
  const proveedorNombre = formatProfileName(
    proveedorProfile,
    getProveedorFromService(svc)?.nombre || "Proveedor",
  );
  const clienteNombre = formatProfileName(clienteProfile, "Cliente");
  const finEmail = booking.fecha_fin || booking.fecha_inicio;
  const precioTotal = Number(booking.precio_total || 0).toFixed(2);
  const mensaje = booking.mensaje?.trim?.() || booking.mensaje || "";

  await sendBookingEmail({
    tipo: "reserva_confirmada",
    solo_cliente: true,
    cliente_id: booking.cliente_id,
    cliente_nombre: clienteNombre,
    proveedor_nombre: proveedorNombre,
    servicio_titulo: svc.titulo || "Servicio",
    fecha_inicio: booking.fecha_inicio,
    fecha_fin: finEmail,
    precio_total: precioTotal,
    mensaje,
    direccion_exacta: svc.direccion_exacta,
    telefono_proveedor: resolveTelefonoProveedor(svc, proveedorProfile),
    modalidad: svc.modalidad,
  });

  await sendBookingEmail({
    tipo: "reserva_confirmada_proveedor",
    proveedor_id: svc.proveedor_id,
    cliente_id: booking.cliente_id,
    cliente_nombre: clienteNombre,
    cliente_telefono: clienteProfile?.telefono || undefined,
    servicio_titulo: svc.titulo || "Servicio",
    fecha_inicio: booking.fecha_inicio,
    fecha_fin: finEmail,
    mensaje,
    ...buildProveedorIngresoEmailFields(booking, proveedorProfile),
  });
}

async function sendPostCompleteBookingEmails({
  userId,
  perfilCliente,
  insertedBookings,
  serviceIds,
  serviceMap,
  precioPorServicioMap,
  precioBasePorServicioMap,
  clienteSinComision,
  mainService,
  fechaInicio,
  fechaFin,
  totalGrupo,
  subtotalGrupo,
  comision,
  mensaje,
}) {
  const finEmail = fechaFin || fechaInicio;
  const clienteProfile = await loadClienteProfileForEmails(userId, perfilCliente);
  const clienteNombre = formatProfileName(clienteProfile, "Cliente");

  const proveedorIds = [
    ...new Set(
      serviceIds.map((id) => serviceMap.get(id)?.proveedor_id).filter(Boolean),
    ),
  ];
  const proveedorProfileMap = new Map();
  if (proveedorIds.length > 0) {
    const { data: proveedorProfiles, error: proveedorProfilesError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, nombre, apellido, telefono, reservas_sin_comision_proveedor, reservas_sin_comision",
        )
        .in("id", proveedorIds);

    if (proveedorProfilesError) {
      console.error(
        "[bookings/complete] Error cargando perfiles proveedor:",
        proveedorProfilesError,
      );
    } else {
      for (const profile of proveedorProfiles ?? []) {
        proveedorProfileMap.set(profile.id, profile);
      }
    }
  }

  const bookingByServiceId = new Map(
    insertedBookings.map((booking) => [booking.service_id, booking]),
  );

  for (const serviceId of serviceIds) {
    const svc = serviceMap.get(serviceId);
    const inserted = bookingByServiceId.get(serviceId);
    if (!svc || !inserted) continue;

    const proveedorProfile = proveedorProfileMap.get(svc.proveedor_id);
    const proveedorNombre = formatProfileName(
      proveedorProfile,
      getProveedorFromService(svc)?.nombre || "Proveedor",
    );

    const booking = {
      id: inserted.id,
      cliente_id: userId,
      fecha_inicio: fechaInicio,
      fecha_fin: finEmail,
      precio_total: precioPorServicioMap.get(serviceId),
      precio_base: precioBasePorServicioMap.get(serviceId),
      cliente_sin_comision: clienteSinComision,
      proveedor_sin_comision: false,
      mensaje: mensaje?.trim() || "",
    };

    if (svc.reserva_inmediata === true) {
      await sendContactEmailsForConfirmedBooking(
        booking,
        svc,
        clienteProfile,
        proveedorProfile,
      );
    } else {
      await sendBookingEmail({
        tipo: "reserva_nueva",
        proveedor_id: svc.proveedor_id,
        proveedor_nombre: proveedorNombre,
        cliente_nombre: clienteNombre,
        servicio_titulo: svc.titulo,
        fecha_inicio: fechaInicio,
        fecha_fin: finEmail,
        booking_id: inserted.id,
        ...buildProveedorIngresoEmailFields(booking, proveedorProfile),
      });
    }
  }

  const pendingServiceIds = serviceIds.filter(
    (id) => serviceMap.get(id)?.reserva_inmediata !== true,
  );

  if (pendingServiceIds.length === 0) {
    return;
  }

  const isMultiService = serviceIds.length > 1;
  const solicitudPayload = {
    tipo: "reserva_solicitud",
    cliente_id: userId,
    cliente_nombre: clienteNombre,
    fecha_inicio: fechaInicio,
    fecha_fin: finEmail,
    precio_total: totalGrupo.toFixed(2),
    subtotal: subtotalGrupo.toFixed(2),
    comision: comision.toFixed(2),
    mensaje: mensaje?.trim() || "",
  };

  if (isMultiService) {
    solicitudPayload.servicios = pendingServiceIds.map((serviceId) => {
      const svc = serviceMap.get(serviceId);
      return {
        titulo: svc.titulo,
        proveedor_id: svc.proveedor_id,
        proveedor_nombre: formatProfileName(
          proveedorProfileMap.get(svc.proveedor_id),
          getProveedorFromService(svc)?.nombre || "Proveedor",
        ),
        precio: precioPorServicioMap.get(serviceId).toFixed(2),
      };
    });
    solicitudPayload.proveedor_id = mainService.proveedor_id;
    solicitudPayload.proveedor_nombre = formatProfileName(
      proveedorProfileMap.get(mainService.proveedor_id),
      getProveedorFromService(mainService)?.nombre || "Proveedor",
    );
    solicitudPayload.servicio_titulo = mainService.titulo;
  } else {
    const svc = serviceMap.get(serviceIds[0]);
    solicitudPayload.proveedor_id = svc.proveedor_id;
    solicitudPayload.proveedor_nombre = formatProfileName(
      proveedorProfileMap.get(svc.proveedor_id),
      getProveedorFromService(svc)?.nombre || "Proveedor",
    );
    solicitudPayload.servicio_titulo = svc.titulo;
  }

  await sendBookingEmail(solicitudPayload);
}

function buildBookingRow({
  svc,
  userId,
  fechaInicio,
  fechaFin,
  hora,
  duracionHoras,
  mensaje,
  precioBase,
  precioTotal,
  clienteSinComision = false,
  creditoAplicado = 0,
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
    precio_base: precioBase,
    precio_total: precioTotal,
    cliente_sin_comision: clienteSinComision,
    proveedor_sin_comision: false,
    credito_aplicado: creditoAplicado,
    estado: isImmediate ? "confirmada" : "pendiente",
    grupo_reserva: grupoReserva,
    payment_intent_id: paymentIntentId,
    familia_id: familiaId || null,
  };
}

const VALID_PAYMENT_INTENT_STATUSES = new Set(["requires_capture", "succeeded"]);

function isPerServicePaymentsFormat(body) {
  return Array.isArray(body?.payments) && body.payments.length > 0;
}

function parsePaymentsByService(payments, serviceIds) {
  const map = new Map();

  for (const entry of payments) {
    if (!entry || typeof entry.service_id !== "string") {
      return { error: "Cada pago debe incluir service_id" };
    }
    if (map.has(entry.service_id)) {
      return { error: `Pago duplicado para service_id ${entry.service_id}` };
    }

    const pi = entry.payment_intent_id;
    if (pi != null && typeof pi !== "string") {
      return { error: `payment_intent_id inválido para ${entry.service_id}` };
    }

    map.set(entry.service_id, pi ?? null);
  }

  for (const serviceId of serviceIds) {
    if (!map.has(serviceId)) {
      return { error: `Falta pago para service_id ${serviceId}` };
    }
  }

  if (map.size !== serviceIds.length) {
    return { error: "payments contiene service_id fuera de service_ids" };
  }

  const seenPaymentIntentIds = new Set();
  for (const pi of map.values()) {
    if (pi == null) continue;
    if (seenPaymentIntentIds.has(pi)) {
      return {
        error: "Un mismo payment_intent_id no puede cubrir varios servicios",
      };
    }
    seenPaymentIntentIds.add(pi);
  }

  return { map };
}

async function validateFamiliaMembership(userId, familiaId) {
  if (!familiaId) return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("familia_miembros")
    .select("id")
    .eq("perfil_id", userId)
    .eq("familia_id", familiaId)
    .eq("estado", "activo")
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json(
      { error: "No perteneces a esa familia" },
      { status: 403 },
    );
  }

  return null;
}

async function validatePerServicePaymentIntent({
  paymentIntentId,
  serviceId,
  userId,
  grupoReserva,
  expectedTarjetaCents,
}) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.metadata?.cliente_id !== userId) {
    return { error: "El pago no pertenece a este usuario", status: 403 };
  }

  if (paymentIntent.metadata?.grupo_reserva !== grupoReserva) {
    return { error: "grupo_reserva no coincide con el pago", status: 400 };
  }

  const metaServiceId = paymentIntent.metadata?.service_id;
  if (metaServiceId && metaServiceId !== serviceId) {
    return {
      error: `El pago no corresponde al servicio ${serviceId}`,
      status: 400,
    };
  }

  if (!VALID_PAYMENT_INTENT_STATUSES.has(paymentIntent.status)) {
    return { error: "El pago no está confirmado", status: 400 };
  }

  const amountDiff = Math.abs(paymentIntent.amount - expectedTarjetaCents);
  if (amountDiff > 2) {
    return {
      error: `El importe del pago no coincide para el servicio ${serviceId}`,
      status: 400,
    };
  }

  return { paymentIntent };
}

async function checkPerServiceIdempotency({
  userId,
  grupoReserva,
  serviceIds,
  paymentsByService,
}) {
  const { data: existingByGrupo, error: existingError } = await supabaseAdmin
    .from("bookings")
    .select("id, service_id, payment_intent_id")
    .eq("grupo_reserva", grupoReserva)
    .eq("cliente_id", userId)
    .in("service_id", serviceIds);

  if (existingError) {
    return { error: NextResponse.json({ error: existingError.message }, { status: 500 }) };
  }

  const existing = existingByGrupo ?? [];
  if (existing.length > 0) {
    const existingServiceIds = new Set(existing.map((b) => b.service_id));
    const allPresent = serviceIds.every((id) => existingServiceIds.has(id));

    if (allPresent) {
      return {
        earlyResponse: NextResponse.json({
          ok: true,
          already_created: true,
          booking_ids: existing.map((b) => b.id),
        }),
      };
    }

    return {
      error: NextResponse.json(
        {
          error:
            "Estado inconsistente: algunas reservas del grupo ya existen y otras no",
        },
        { status: 409 },
      ),
    };
  }

  const paymentIntentIds = [
    ...new Set(
      [...paymentsByService.values()].filter(
        (pi) => typeof pi === "string" && pi.length > 0,
      ),
    ),
  ];

  if (paymentIntentIds.length === 0) {
    return {};
  }

  const { data: existingByPi, error: piError } = await supabaseAdmin
    .from("bookings")
    .select("id, payment_intent_id, grupo_reserva, service_id")
    .in("payment_intent_id", paymentIntentIds);

  if (piError) {
    return { error: NextResponse.json({ error: piError.message }, { status: 500 }) };
  }

  for (const row of existingByPi ?? []) {
    if (row.grupo_reserva !== grupoReserva) {
      return {
        error: NextResponse.json(
          {
            error: `payment_intent_id ${row.payment_intent_id} ya está asociado a otra reserva`,
          },
          { status: 409 },
        ),
      };
    }
  }

  return {};
}

async function finalizeInsertedBookings({
  userId,
  perfilCliente,
  clienteSinComision,
  creditoDisponible,
  creditoAplicado,
  insertedBookings,
  insertedBookingIds,
  rollbackPaymentIntentId,
  fechaInicio,
  fechaFin,
  familiaId,
  mainService,
  mainServiceId,
  serviceIds,
  serviceMap,
  precioPorServicioMap,
  precioBasePorServicioMap,
  totalGrupo,
  subtotalGrupo,
  comision,
  mensaje,
  grupoReserva,
}) {
  const finDisponibilidad = fechaFin || fechaInicio;

  const { error: disponibilidadError } = await supabaseAdmin
    .from("disponibilidad")
    .insert(
      insertedBookings.map((booking) => ({
        service_id: booking.service_id,
        fecha_inicio: fechaInicio,
        fecha_fin: finDisponibilidad,
        booking_id: booking.id,
      })),
    );

  if (disponibilidadError) {
    await rollbackInsertedBookings(insertedBookingIds, rollbackPaymentIntentId);

    if (isDisponibilidadExclusionError(disponibilidadError)) {
      return NextResponse.json(
        {
          error: "Estas fechas se acaban de ocupar. Por favor elige otras.",
        },
        { status: 409 },
      );
    }

    console.error(
      "[bookings/complete] No se pudo bloquear disponibilidad tras crear bookings:",
      disponibilidadError,
      {
        payment_intent_id: rollbackPaymentIntentId,
        booking_ids: insertedBookingIds,
      },
    );
    return NextResponse.json(
      { error: disponibilidadError.message },
      { status: 500 },
    );
  }

  try {
    await rewardReferidorPrimeraReserva(userId, supabaseAdmin);
  } catch (err) {
    console.error("[bookings/complete] rewardReferidorPrimeraReserva:", err);
  }

  if (clienteSinComision) {
    try {
      await decrementReservasSinComisionCliente(userId, perfilCliente);
    } catch (err) {
      console.error(
        "[bookings/complete] No se pudo restar reservas_sin_comision_cliente:",
        err,
      );
    }
  }

  if (creditoAplicado > 0) {
    try {
      const { error: creditError } = await supabaseAdmin
        .from("profiles")
        .update({
          credito_disponible: Math.max(0, creditoDisponible - creditoAplicado),
        })
        .eq("id", userId);
      if (creditError) {
        console.error(
          "[bookings/complete] No se pudo restar credito_disponible:",
          creditError,
        );
      }
    } catch (err) {
      console.error(
        "[bookings/complete] No se pudo restar credito_disponible:",
        err,
      );
    }
  }

  await sendPostCompleteBookingEmails({
    userId,
    perfilCliente,
    insertedBookings,
    serviceIds,
    serviceMap,
    precioPorServicioMap,
    precioBasePorServicioMap,
    clienteSinComision,
    mainService,
    fechaInicio,
    fechaFin,
    totalGrupo,
    subtotalGrupo,
    comision,
    mensaje,
  });

  return NextResponse.json({
    ok: true,
    booking_ids: insertedBookings.map((b) => b.id),
    grupo_reserva: grupoReserva,
  });
}

async function completePerServicePayments(userId, body) {
  const {
    payments,
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

  if (!grupo_reserva || typeof grupo_reserva !== "string") {
    return NextResponse.json({ error: "Falta grupo_reserva" }, { status: 400 });
  }
  if (!main_service_id || typeof main_service_id !== "string") {
    return NextResponse.json({ error: "Falta main_service_id" }, { status: 400 });
  }
  if (!Array.isArray(service_ids) || service_ids.length === 0) {
    return NextResponse.json(
      { error: "Falta service_ids (debe ser un array no vacío)" },
      { status: 400 },
    );
  }

  const uniqueServiceIds = [...new Set(service_ids)];
  const parsedPayments = parsePaymentsByService(payments, uniqueServiceIds);
  if (parsedPayments.error) {
    return NextResponse.json({ error: parsedPayments.error }, { status: 400 });
  }
  const paymentsByService = parsedPayments.map;

  const { data: services, error: servicesError } = await supabaseAdmin
    .from("services")
    .select(SERVICE_SELECT)
    .in("id", uniqueServiceIds);

  if (servicesError) {
    return NextResponse.json({ error: servicesError.message }, { status: 500 });
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

  const bookability = validateServicesBookable(services);
  if (!bookability.ok) {
    return NextResponse.json({ error: bookability.error }, { status: 409 });
  }

  const { data: perfilCliente, error: perfilError } = await supabaseAdmin
    .from("profiles")
    .select("reservas_sin_comision_cliente, reservas_sin_comision, credito_disponible, nombre")
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

  const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;

  let tarifasPorServicio;
  try {
    tarifasPorServicio = await cargarTarifasPorServicios(
      supabaseAdmin,
      service_ids,
      fecha_inicio,
      fecha_fin,
    );
  } catch (tarifasError) {
    return NextResponse.json(
      { error: tarifasError.message || "Error al cargar tarifas" },
      { status: 500 },
    );
  }

  const preciosPorServicio = [];
  let subtotalGrupo = 0;

  for (const serviceId of service_ids) {
    const svc = serviceMap.get(serviceId);
    const unitOverride =
      serviceId === main_service_id ? precioEspecialOverride : null;

    const calc = calculateServiceBasePrice(
      svc,
      dateContext,
      unitOverride,
      tarifasPorServicio[serviceId] ?? {},
    );

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

    const { precio_base, precio_total } = buildServicePricing(
      calc.base,
      clienteSinComision,
    );

    preciosPorServicio.push({
      service_id: serviceId,
      precio_base,
      precio_total,
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

  const precioPorServicioMap = new Map(
    preciosPorServicio.map((p) => [p.service_id, p.precio_total]),
  );
  const precioBasePorServicioMap = new Map(
    preciosPorServicio.map((p) => [p.service_id, p.precio_base]),
  );

  const creditoPorServicioMap = splitCreditoPorServicio(
    preciosPorServicio,
    creditoAplicado,
    totalGrupo,
  );

  for (const serviceId of uniqueServiceIds) {
    const precioTotal = precioPorServicioMap.get(serviceId);
    const creditoServicio = creditoPorServicioMap.get(serviceId) ?? 0;
    const tarjetaEsperada = roundMoney(precioTotal - creditoServicio);
    const paymentIntentId = paymentsByService.get(serviceId);

    if (tarjetaEsperada <= 0) {
      if (paymentIntentId != null) {
        return NextResponse.json(
          {
            error: `El servicio ${serviceId} no requiere pago con tarjeta (cubierto con crédito)`,
          },
          { status: 400 },
        );
      }
      continue;
    }

    if (!paymentIntentId) {
      return NextResponse.json(
        {
          error: `Falta payment_intent_id para el servicio ${serviceId}`,
        },
        { status: 400 },
      );
    }

    const expectedTarjetaCents = Math.round(tarjetaEsperada * 100);
    const validation = await validatePerServicePaymentIntent({
      paymentIntentId,
      serviceId,
      userId,
      grupoReserva: grupo_reserva,
      expectedTarjetaCents,
    });

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status ?? 400 },
      );
    }
  }

  if (familia_id) {
    const familiaError = await validateFamiliaMembership(userId, familia_id);
    if (familiaError) return familiaError;
  }

  const idempotency = await checkPerServiceIdempotency({
    userId,
    grupoReserva: grupo_reserva,
    serviceIds: uniqueServiceIds,
    paymentsByService,
  });
  if (idempotency.error) return idempotency.error;
  if (idempotency.earlyResponse) return idempotency.earlyResponse;

  const finDisponibilidad = fecha_fin || fecha_inicio;
  const uniqueServicesForDates = [...new Set(service_ids)];

  for (const serviceId of uniqueServicesForDates) {
    let solapamiento;
    try {
      solapamiento = await hasDisponibilidadSolapamiento(
        serviceId,
        fecha_inicio,
        finDisponibilidad,
      );
    } catch (overlapError) {
      return NextResponse.json(
        { error: overlapError.message },
        { status: 500 },
      );
    }

    if (solapamiento) {
      return NextResponse.json(
        {
          error:
            "Estas fechas ya no están disponibles para uno de los servicios. Por favor elige otras.",
        },
        { status: 409 },
      );
    }
  }

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
      precioBase: precioBasePorServicioMap.get(serviceId),
      precioTotal: precioPorServicioMap.get(serviceId),
      clienteSinComision,
      creditoAplicado: creditoPorServicioMap.get(serviceId) ?? 0,
      grupoReserva: grupo_reserva,
      paymentIntentId: paymentsByService.get(serviceId),
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

  const insertedBookingIds = insertedBookings.map((b) => b.id);
  const rollbackPaymentIntentId =
    [...paymentsByService.values()].find((pi) => typeof pi === "string") ?? null;

  return finalizeInsertedBookings({
    userId,
    perfilCliente,
    clienteSinComision,
    creditoDisponible,
    creditoAplicado,
    insertedBookings,
    insertedBookingIds,
    rollbackPaymentIntentId,
    fechaInicio: fecha_inicio,
    fechaFin: fecha_fin,
    familiaId: familia_id,
    mainService,
    mainServiceId: main_service_id,
    serviceIds: service_ids,
    serviceMap,
    precioPorServicioMap,
    precioBasePorServicioMap,
    totalGrupo,
    subtotalGrupo,
    comision,
    mensaje,
    grupoReserva: grupo_reserva,
  });
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

    if (isPerServicePaymentsFormat(body)) {
      if (
        typeof body.payment_intent_id === "string" &&
        body.payment_intent_id.length > 0
      ) {
        return NextResponse.json(
          { error: "Formato de pago ambiguo" },
          { status: 400 },
        );
      }
      return completePerServicePayments(userId, body);
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

    const bookability = validateServicesBookable(services);
    if (!bookability.ok) {
      return NextResponse.json({ error: bookability.error }, { status: 409 });
    }

    const { data: perfilCliente, error: perfilError } = await supabaseAdmin
      .from("profiles")
      .select("reservas_sin_comision_cliente, reservas_sin_comision, credito_disponible, nombre")
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

    const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;

    let tarifasPorServicio;
    try {
      tarifasPorServicio = await cargarTarifasPorServicios(
        supabaseAdmin,
        service_ids,
        fecha_inicio,
        fecha_fin,
      );
    } catch (tarifasError) {
      return NextResponse.json(
        { error: tarifasError.message || "Error al cargar tarifas" },
        { status: 500 },
      );
    }

    const preciosPorServicio = [];
    let subtotalGrupo = 0;

    for (const serviceId of service_ids) {
      const svc = serviceMap.get(serviceId);
      const unitOverride =
        serviceId === main_service_id ? precioEspecialOverride : null;

      const calc = calculateServiceBasePrice(
        svc,
        dateContext,
        unitOverride,
        tarifasPorServicio[serviceId] ?? {},
      );

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

      const { precio_base, precio_total } = buildServicePricing(
        calc.base,
        clienteSinComision,
      );

      preciosPorServicio.push({
        service_id: serviceId,
        precio_base,
        precio_total,
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
    const precioBasePorServicioMap = new Map(
      preciosPorServicio.map((p) => [p.service_id, p.precio_base]),
    );

    const creditoPorServicioMap = splitCreditoPorServicio(
      preciosPorServicio,
      creditoAplicado,
      totalGrupo,
    );

    const finDisponibilidad = fecha_fin || fecha_inicio;
    const uniqueServicesForDates = [...new Set(service_ids)];

    for (const serviceId of uniqueServicesForDates) {
      let solapamiento;
      try {
        solapamiento = await hasDisponibilidadSolapamiento(
          serviceId,
          fecha_inicio,
          finDisponibilidad,
        );
      } catch (overlapError) {
        return NextResponse.json(
          { error: overlapError.message },
          { status: 500 },
        );
      }

      if (solapamiento) {
        return NextResponse.json(
          {
            error:
              "Estas fechas ya no están disponibles para uno de los servicios. Por favor elige otras.",
          },
          { status: 409 },
        );
      }
    }

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
        precioBase: precioBasePorServicioMap.get(serviceId),
        precioTotal: precioPorServicioMap.get(serviceId),
        clienteSinComision,
        creditoAplicado: creditoPorServicioMap.get(serviceId) ?? 0,
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

    const insertedBookingIds = insertedBookings.map((b) => b.id);

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
      await rollbackInsertedBookings(insertedBookingIds, payment_intent_id);

      if (isDisponibilidadExclusionError(disponibilidadError)) {
        return NextResponse.json(
          {
            error:
              "Estas fechas se acaban de ocupar. Por favor elige otras.",
          },
          { status: 409 },
        );
      }

      console.error(
        "[bookings/complete] No se pudo bloquear disponibilidad tras crear bookings:",
        disponibilidadError,
        {
          payment_intent_id,
          booking_ids: insertedBookingIds,
        },
      );
      return NextResponse.json(
        { error: disponibilidadError.message },
        { status: 500 },
      );
    }

    try {
      await rewardReferidorPrimeraReserva(userId, supabaseAdmin);
    } catch (err) {
      console.error("[bookings/complete] rewardReferidorPrimeraReserva:", err);
    }

    if (clienteSinComision) {
      try {
        await decrementReservasSinComisionCliente(userId, perfilCliente);
      } catch (err) {
        console.error(
          "[bookings/complete] No se pudo restar reservas_sin_comision_cliente:",
          err,
        );
      }
    }

    if (creditoAplicado > 0) {
      try {
        const { error: creditError } = await supabaseAdmin
          .from("profiles")
          .update({
            credito_disponible: Math.max(0, creditoDisponible - creditoAplicado),
          })
          .eq("id", userId);
        if (creditError) {
          console.error(
            "[bookings/complete] No se pudo restar credito_disponible:",
            creditError,
          );
        }
      } catch (err) {
        console.error(
          "[bookings/complete] No se pudo restar credito_disponible:",
          err,
        );
      }
    }

    await sendPostCompleteBookingEmails({
      userId,
      perfilCliente,
      insertedBookings,
      serviceIds: service_ids,
      serviceMap,
      precioPorServicioMap,
      precioBasePorServicioMap,
      clienteSinComision,
      mainService,
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      totalGrupo,
      subtotalGrupo,
      comision,
      mensaje,
    });

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
