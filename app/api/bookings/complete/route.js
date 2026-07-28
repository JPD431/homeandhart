import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyClientPrice,
  billingNeedsDuracionHoras,
  billingNeedsFechaFin,
  billingNeedsHora,
  calculateServiceBasePrice,
  COMMISSION_RATE,
  getServiceModalidadesRows,
  resolveBillingForService,
} from "@/app/lib/pricing-reserva";
import { cargarTarifasPorFecha } from "@/app/lib/tarifas";
import { loadServiceModalidadesRows } from "@/app/lib/service-modalidades-server";
import {
  attachContactsToServicesAdmin,
  buildProviderContactEmailFields,
} from "@/app/lib/service-contact";
import { syncBookingContactCliente, loadBookingContactClienteAdmin } from "@/app/lib/booking-contact-cliente";
import {
  normalizeLugarPayloadForBooking,
  shouldShowClienteDireccionToProvider,
} from "@/app/lib/lugar-servicio";
import {
  COBROS_INACTIVE_MSG,
  getProveedorFromService,
} from "@/app/lib/service-bookable";
import { rewardReferidorPrimeraReserva } from "@/app/lib/referidos";
import { assertUserIsDniVerified } from "@/app/lib/dni";
import { assertUserHasTelefono } from "@/app/lib/profile-telefono";
import { notifyBookingEvent } from "@/app/lib/notifications";
import { validateNumHuespedesParaReserva } from "@/app/lib/huespedes-precio";
import { supportsModalidadCobro } from "@/app/lib/modalidad-cobro";
import {
  debitCreditoDisponible,
  releaseCreditoDebito,
} from "@/app/lib/credito-debito";

const MAX_CREDITO_PORCENTAJE = 0.6;

function getReservasSinComisionCliente(perfil) {
  return Number(perfil?.reservas_sin_comision_cliente) || 0;
}

function getReservasSinComisionProveedor(perfil) {
  return Number(perfil?.reservas_sin_comision_proveedor) || 0;
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
  modalidad,
  capacidad_maxima,
  huespedes_incluidos,
  precio_huesped_extra,
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

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * Valida capacidad y resuelve num_huespedes por servicio.
 * Sin modelo por huésped → null (precio plano, retrocompatible).
 * @param {object[]} services
 * @param {unknown} numHuespedesRaw — valor único (legacy) o Map serviceId→num
 */
function resolveNumHuespedesPorServicio(services, numHuespedesRaw) {
  const map = new Map();
  const perService =
    numHuespedesRaw instanceof Map ? numHuespedesRaw : null;

  for (const svc of services) {
    const raw = perService
      ? perService.get(svc.id)
      : numHuespedesRaw;
    const validated = validateNumHuespedesParaReserva(svc, raw);
    if (!validated.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: validated.error,
            service_id: svc.id,
            service: svc.titulo || svc.id,
          },
          { status: 400 },
        ),
      };
    }
    map.set(svc.id, validated.num);
  }
  return { ok: true, map };
}

/**
 * Paso 2c: contexto de reserva por servicio.
 * Si body.service_contexts viene, cada línea usa SUS fechas/modalidad/huéspedes.
 * Si no, legacy: el mismo flat para todos (retrocompat 1 servicio / antiguos clientes).
 *
 * @returns {{ ok: true, map: Map<string, object> } | { ok: false, response: NextResponse }}
 */
function resolveServiceContextsById(body, serviceIds, {
  fecha_inicio = null,
  fecha_fin = null,
  hora = null,
  duracion_horas = null,
  modalidad_cobro = null,
  num_huespedes = null,
} = {}) {
  const raw = body?.service_contexts;
  const map = new Map();

  if (Array.isArray(raw) && raw.length > 0) {
    for (const entry of raw) {
      if (!entry || typeof entry.service_id !== "string") {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Cada service_context debe incluir service_id" },
            { status: 400 },
          ),
        };
      }
      if (map.has(entry.service_id)) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: `service_context duplicado para ${entry.service_id}`,
            },
            { status: 400 },
          ),
        };
      }
      map.set(entry.service_id, {
        service_id: entry.service_id,
        fecha_inicio: entry.fecha_inicio ?? null,
        fecha_fin: entry.fecha_fin ?? entry.fecha_inicio ?? null,
        hora: entry.hora ?? null,
        duracion_horas: entry.duracion_horas ?? null,
        modalidad_cobro: entry.modalidad_cobro ?? null,
        num_huespedes:
          entry.num_huespedes !== undefined ? entry.num_huespedes : null,
        lugar_servicio: entry.lugar_servicio ?? null,
        direccion_cliente: entry.direccion_cliente ?? null,
        direccion_cliente_a_definir:
          entry.direccion_cliente_a_definir !== undefined
            ? entry.direccion_cliente_a_definir
            : null,
        payment_intent_id:
          typeof entry.payment_intent_id === "string"
            ? entry.payment_intent_id
            : null,
      });
    }

    for (const id of serviceIds) {
      if (!map.has(id)) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: `Falta service_context para el servicio ${id}`,
              service_id: id,
            },
            { status: 400 },
          ),
        };
      }
    }

    for (const id of map.keys()) {
      if (!serviceIds.includes(id)) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: `service_context con service_id fuera de service_ids: ${id}`,
            },
            { status: 400 },
          ),
        };
      }
    }

    return { ok: true, map };
  }

  // Legacy: un solo contexto compartido para todos.
  for (const id of serviceIds) {
    map.set(id, {
      service_id: id,
      fecha_inicio: fecha_inicio ?? null,
      fecha_fin: fecha_fin ?? fecha_inicio ?? null,
      hora: hora ?? null,
      duracion_horas: duracion_horas ?? null,
      modalidad_cobro: modalidad_cobro ?? null,
      num_huespedes: num_huespedes ?? null,
      lugar_servicio: null,
      direccion_cliente: null,
      direccion_cliente_a_definir: null,
      payment_intent_id: null,
    });
  }
  return { ok: true, map };
}

function serviceNeedsRequireModalidad(svc) {
  return (
    supportsModalidadCobro(svc.vertical) &&
    getServiceModalidadesRows(svc).length > 1
  );
}

/**
 * Recalcula precio de CADA servicio con SU contexto (fechas/modalidad/huéspedes)
 * + modalidades + tarifas por fecha propias.
 */
async function computePreciosPorServicioConContextos({
  serviceIds,
  serviceMap,
  contextByServiceId,
  numHuespedesPorServicio,
  clienteSinComision,
}) {
  const preciosPorServicio = [];
  let subtotalGrupo = 0;

  for (const serviceId of serviceIds) {
    const svc = serviceMap.get(serviceId);
    const ctx = contextByServiceId.get(serviceId);
    if (!svc || !ctx) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Contexto incompleto para ${serviceId}`, service_id: serviceId },
          { status: 400 },
        ),
      };
    }

    if (!ctx.fecha_inicio) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Faltan fechas para ${svc.titulo || serviceId}`,
            service_id: serviceId,
          },
          { status: 400 },
        ),
      };
    }

    let tarifasPorFecha = {};
    try {
      tarifasPorFecha = await cargarTarifasPorFecha(
        supabaseAdmin,
        serviceId,
        ctx.fecha_inicio,
        ctx.fecha_fin || ctx.fecha_inicio,
      );
    } catch (tarifasError) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              tarifasError.message ||
              `Error al cargar tarifas de ${svc.titulo || serviceId}`,
            service_id: serviceId,
          },
          { status: 500 },
        ),
      };
    }

    // Precio solo desde BD (services / modalidades / tarifas / oferta_descuento).
    // Nunca unitPriceOverride desde el body (precio_especial del cliente).
    const calc = calculateServiceBasePrice(
      svc,
      {
        fechaInicio: ctx.fecha_inicio,
        fechaFin: ctx.fecha_fin || ctx.fecha_inicio,
        duracionHoras: ctx.duracion_horas,
        mainVertical: svc.vertical,
        modalidadCobro: ctx.modalidad_cobro,
        numHuespedes: numHuespedesPorServicio.get(serviceId),
        requireModalidad: serviceNeedsRequireModalidad(svc),
      },
      null,
      tarifasPorFecha,
    );

    if (!calc.ready) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `No se pudo calcular el precio de ${svc.titulo || serviceId}`,
            service_id: serviceId,
            detail: calc.detail,
          },
          { status: 400 },
        ),
      };
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
      modalidad_cobro: calc.modalidadCobro ?? null,
      fecha_inicio: ctx.fecha_inicio,
      fecha_fin: ctx.fecha_fin || ctx.fecha_inicio,
      hora: ctx.hora,
      duracion_horas: ctx.duracion_horas,
    });
  }

  return {
    ok: true,
    preciosPorServicio,
    subtotalGrupo: roundMoney(subtotalGrupo),
  };
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
  try {
    const result = await sendPlatformEmail(payload);
    if (!result.ok) {
      console.error(
        "[bookings/complete] FALLO email (reserva NO abortada)",
        `tipo=${payload?.tipo || "?"}`,
        `status=${result.status ?? "?"}`,
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error(
      "[bookings/complete] EXCEPCIÓN email (reserva NO abortada)",
      payload?.tipo,
      err,
    );
  }
}

function formatProfileName(profile, fallback = "Usuario") {
  const name = [profile?.nombre, profile?.apellido].filter(Boolean).join(" ");
  return name || fallback;
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
  const creditoAplicado = Number(booking.credito_aplicado) || 0;
  const mensaje = booking.mensaje?.trim?.() || booking.mensaje || "";

  // Contacto solo en confirmada (igual canShowProviderContact); desde service_contact.
  const contactFields = await buildProviderContactEmailFields({
    estado: "confirmada",
    serviceId: svc.id,
    service: svc,
    lugarServicio: booking.lugar_servicio ?? null,
    telefonoFallback: proveedorProfile?.telefono || null,
    adminClient: supabaseAdmin,
  });

  const clienteContactRow = shouldShowClienteDireccionToProvider(
    booking.lugar_servicio,
    svc.modalidad,
  )
    ? await loadBookingContactClienteAdmin(booking.id, supabaseAdmin)
    : null;

  await sendBookingEmail({
    tipo: "reserva_confirmada",
    solo_cliente: true,
    cliente_id: booking.cliente_id,
    cliente_nombre: clienteNombre,
    proveedor_nombre: proveedorNombre,
    proveedor_id: svc.proveedor_id,
    service_id: svc.id,
    servicio_titulo: svc.titulo || "Servicio",
    fecha_inicio: booking.fecha_inicio,
    fecha_fin: finEmail,
    precio_total: precioTotal,
    credito_aplicado: creditoAplicado,
    mensaje,
    modalidad: svc.modalidad,
    vertical: svc.vertical,
    ...contactFields,
  });

  await sendBookingEmail({
    tipo: "reserva_confirmada_proveedor",
    proveedor_id: svc.proveedor_id,
    cliente_id: booking.cliente_id,
    cliente_nombre: clienteNombre,
    cliente_telefono: clienteProfile?.telefono || undefined,
    cliente_direccion: clienteContactRow?.direccion_cliente || undefined,
    cliente_direccion_a_definir:
      booking.direccion_cliente_a_definir === true ? true : undefined,
    lugar_servicio: booking.lugar_servicio || undefined,
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
  creditoAplicado = 0,
  creditoPorServicioMap = new Map(),
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
          "id, nombre, apellido, telefono, reservas_sin_comision_proveedor",
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

    const bookingFin =
      inserted.fecha_fin || inserted.fecha_inicio || finEmail;
    const booking = {
      id: inserted.id,
      cliente_id: userId,
      fecha_inicio: inserted.fecha_inicio || fechaInicio,
      fecha_fin: bookingFin,
      precio_total: precioPorServicioMap.get(serviceId),
      precio_base: precioBasePorServicioMap.get(serviceId),
      cliente_sin_comision: clienteSinComision,
      proveedor_sin_comision: false,
      credito_aplicado: creditoPorServicioMap.get(serviceId) ?? 0,
      mensaje: mensaje?.trim() || "",
      lugar_servicio: inserted.lugar_servicio ?? null,
      direccion_cliente_a_definir:
        inserted.direccion_cliente_a_definir ?? null,
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

      console.log("[bookings/complete] Creando notificación reserva_nueva", {
        bookingId: inserted.id,
        proveedorId: svc.proveedor_id,
        servicioId: serviceId,
        reserva_inmediata: svc.reserva_inmediata,
      });

      const notifResult = await notifyBookingEvent(supabaseAdmin, {
        tipo: "reserva_nueva",
        bookingId: inserted.id,
        proveedorId: svc.proveedor_id,
        clienteNombre,
        servicioTitulo: svc.titulo,
        fechaInicio,
        fechaFin: finEmail,
      });

      if (!notifResult?.ok) {
        console.error(
          "[bookings/complete] Notificación reserva_nueva NO creada:",
          notifResult,
        );
      }
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
    credito_aplicado: creditoAplicado,
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

async function attachModalidadesToServices(services) {
  const list = Array.isArray(services) ? services : [];
  await Promise.all(
    list.map(async (svc) => {
      if (!supportsModalidadCobro(svc?.vertical)) {
        svc.modalidades = [];
        return;
      }
      svc.modalidades = await loadServiceModalidadesRows(svc.id);
    }),
  );
  return list;
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
  numHuespedes = null,
  modalidadCobro = null,
  lugarServicio = null,
  direccionCliente = null,
  direccionClienteADefinir = null,
}) {
  const v = svc.vertical;
  const isImmediate = svc.reserva_inmediata === true;
  const billing = resolveBillingForService(svc, modalidadCobro);
  const modalidadUsed =
    billing.kind === "modalidad" ? billing.modalidad : null;

  const needsFin = billingNeedsFechaFin(billing, v);
  const needsHora = billingNeedsHora(billing);
  // Legacy ninos: always hora+duracion; modality hora: same; medio_dia: hora only
  const storeHora =
    needsHora === true ||
    (billing.kind === "legacy" && v === "ninos");
  const storeDuracion =
    billingNeedsDuracionHoras(billing) ||
    (billing.kind === "legacy" && v === "ninos");

  const lugarNorm = normalizeLugarPayloadForBooking(
    {
      lugar_servicio: lugarServicio,
      direccion_cliente: direccionCliente,
      direccion_cliente_a_definir: direccionClienteADefinir,
    },
    svc.modalidad,
    svc.vertical,
  );

  return {
    cliente_id: userId,
    service_id: svc.id,
    fecha_inicio: fechaInicio || null,
    fecha_fin: needsFin ? fechaFin || fechaInicio || null : null,
    hora: storeHora ? hora || null : null,
    duracion_horas: storeDuracion ? Number(duracionHoras) || null : null,
    modalidad_cobro: modalidadUsed,
    lugar_servicio: lugarNorm.lugar_servicio,
    direccion_cliente_a_definir: lugarNorm.direccion_cliente_a_definir,
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
    num_huespedes: numHuespedes,
  };
}

/**
 * Tras insertar bookings: sincroniza booking_contact_cliente por línea.
 * @param {Array<{ id: string, service_id: string }>} insertedBookings
 * @param {Map<string, object>} contextByServiceId
 * @param {Map<string, object>} serviceMap
 */
async function syncClienteContactsForInsertedBookings(
  insertedBookings,
  contextByServiceId,
  serviceMap,
) {
  for (const row of insertedBookings ?? []) {
    const svc = serviceMap.get(row.service_id);
    const ctx = contextByServiceId.get(row.service_id) || {};
    const norm = normalizeLugarPayloadForBooking(
      {
        lugar_servicio: ctx.lugar_servicio,
        direccion_cliente: ctx.direccion_cliente,
        direccion_cliente_a_definir: ctx.direccion_cliente_a_definir,
      },
      svc?.modalidad,
      svc?.vertical,
    );
    await syncBookingContactCliente(
      row.id,
      {
        direccion_cliente: norm.direccion_cliente,
        a_definir:
          norm.lugar_servicio !== "casa_cliente" ||
          norm.direccion_cliente_a_definir === true ||
          !norm.direccion_cliente,
      },
      supabaseAdmin,
    );
  }
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
  creditoAplicado,
  creditoPorServicioMap,
  creditoIdempotencyKey = null,
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
  const { error: disponibilidadError } = await supabaseAdmin
    .from("disponibilidad")
    .insert(
      insertedBookings.map((booking) => ({
        service_id: booking.service_id,
        fecha_inicio: booking.fecha_inicio || fechaInicio,
        fecha_fin:
          booking.fecha_fin ||
          booking.fecha_inicio ||
          fechaFin ||
          fechaInicio,
        booking_id: booking.id,
        tipo: "reserva",
      })),
    );

  if (disponibilidadError) {
    await rollbackInsertedBookings(insertedBookingIds, rollbackPaymentIntentId);
    if (creditoIdempotencyKey) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras fallo disponibilidad:",
          releaseErr?.message ?? releaseErr,
        );
      }
    }

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
    creditoAplicado,
    creditoPorServicioMap,
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
    num_huespedes = null,
    modalidad_cobro = null,
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

  const { data: servicesRaw, error: servicesError } = await supabaseAdmin
    .from("services")
    .select(SERVICE_SELECT)
    .in("id", uniqueServiceIds);

  if (servicesError) {
    return NextResponse.json({ error: servicesError.message }, { status: 500 });
  }

  if (!servicesRaw || servicesRaw.length !== uniqueServiceIds.length) {
    const foundIds = new Set(servicesRaw?.map((s) => s.id) ?? []);
    const missing = uniqueServiceIds.filter((id) => !foundIds.has(id));
    return NextResponse.json(
      { error: "Algunos servicios no existen", missing_service_ids: missing },
      { status: 400 },
    );
  }

  const servicesWithMods = await attachModalidadesToServices(servicesRaw);
  const services = await attachContactsToServicesAdmin(
    servicesWithMods,
    supabaseAdmin,
  );
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

  const contextsResolved = resolveServiceContextsById(body, uniqueServiceIds, {
    fecha_inicio,
    fecha_fin,
    hora,
    duracion_horas,
    modalidad_cobro,
    num_huespedes,
  });
  if (!contextsResolved.ok) return contextsResolved.response;
  const contextByServiceId = contextsResolved.map;

  const numHuespedesRawMap = new Map(
    [...contextByServiceId.entries()].map(([id, ctx]) => [
      id,
      ctx.num_huespedes,
    ]),
  );
  const huespedesResolved = resolveNumHuespedesPorServicio(
    services,
    numHuespedesRawMap,
  );
  if (!huespedesResolved.ok) return huespedesResolved.response;
  const numHuespedesPorServicio = huespedesResolved.map;

  const { data: perfilCliente, error: perfilError } = await supabaseAdmin
    .from("profiles")
    .select("reservas_sin_comision_cliente, nombre")
    .eq("id", userId)
    .maybeSingle();

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 500 });
  }

  const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;

  const priced = await computePreciosPorServicioConContextos({
    serviceIds: service_ids,
    serviceMap,
    contextByServiceId,
    numHuespedesPorServicio,
    clienteSinComision,
  });
  if (!priced.ok) return priced.response;

  const { preciosPorServicio } = priced;
  let subtotalGrupo = priced.subtotalGrupo;
  const comision = clienteSinComision
    ? 0
    : roundMoney(subtotalGrupo * COMMISSION_RATE);
  const totalGrupo = roundMoney(subtotalGrupo + comision);

  const topeCredito = roundMoney(totalGrupo * MAX_CREDITO_PORCENTAJE);

  const precioPorServicioMap = new Map(
    preciosPorServicio.map((p) => [p.service_id, p.precio_total]),
  );
  const precioBasePorServicioMap = new Map(
    preciosPorServicio.map((p) => [p.service_id, p.precio_base]),
  );
  const modalidadPorServicioMap = new Map(
    preciosPorServicio.map((p) => [p.service_id, p.modalidad_cobro ?? null]),
  );

  if (familia_id) {
    const familiaError = await validateFamiliaMembership(userId, familia_id);
    if (familiaError) return familiaError;
  }

  // Idempotencia antes del débito: reintento del mismo grupo no vuelve a debitar.
  const idempotency = await checkPerServiceIdempotency({
    userId,
    grupoReserva: grupo_reserva,
    serviceIds: uniqueServiceIds,
    paymentsByService,
  });
  if (idempotency.error) return idempotency.error;
  if (idempotency.earlyResponse) return idempotency.earlyResponse;

  const creditoIdempotencyKey = `complete:grupo:${grupo_reserva}`;
  let creditoAplicado = 0;
  try {
    creditoAplicado = await debitCreditoDisponible(
      supabaseAdmin,
      userId,
      topeCredito,
      creditoIdempotencyKey,
    );
  } catch (debitErr) {
    console.error(
      "[bookings/complete] Error en débito atómico de crédito:",
      debitErr?.message ?? debitErr,
    );
    return NextResponse.json(
      { error: debitErr?.message || "Error al aplicar crédito" },
      { status: 500 },
    );
  }

  const creditoPorServicioMap = splitCreditoPorServicio(
    preciosPorServicio,
    creditoAplicado,
    totalGrupo,
  );

  for (const serviceId of uniqueServiceIds) {
    const precioTotal = precioPorServicioMap.get(serviceId);
    const creditoServicio = creditoPorServicioMap.get(serviceId) ?? 0;
    const tarjetaEsperada = roundMoney(precioTotal - creditoServicio);
    const ctx = contextByServiceId.get(serviceId);
    const paymentIntentId =
      paymentsByService.get(serviceId) ?? ctx?.payment_intent_id ?? null;

    if (tarjetaEsperada <= 0) {
      if (paymentIntentId != null) {
        try {
          await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
        } catch (releaseErr) {
          console.error(
            "[bookings/complete] Error liberando crédito tras PI sobrante:",
            releaseErr?.message ?? releaseErr,
          );
        }
        return NextResponse.json(
          {
            error: `El servicio ${serviceId} no requiere pago con tarjeta (cubierto con crédito)`,
            service_id: serviceId,
          },
          { status: 400 },
        );
      }
      continue;
    }

    if (!paymentIntentId) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras falta de PI:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        {
          error: `Falta payment_intent_id para el servicio ${serviceId}`,
          service_id: serviceId,
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
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras PI inválido:",
          releaseErr?.message ?? releaseErr,
        );
      }
      const svc = serviceMap.get(serviceId);
      return NextResponse.json(
        {
          error:
            validation.error ||
            `El importe no cuadra para ${svc?.titulo || serviceId}`,
          service_id: serviceId,
        },
        { status: validation.status ?? 400 },
      );
    }
  }

  for (const serviceId of uniqueServiceIds) {
    const ctx = contextByServiceId.get(serviceId);
    const inicio = ctx.fecha_inicio;
    const fin = ctx.fecha_fin || ctx.fecha_inicio;
    let solapamiento;
    try {
      solapamiento = await hasDisponibilidadSolapamiento(
        serviceId,
        inicio,
        fin,
      );
    } catch (overlapError) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras solapamiento:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        { error: overlapError.message, service_id: serviceId },
        { status: 500 },
      );
    }

    if (solapamiento) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras fechas ocupadas:",
          releaseErr?.message ?? releaseErr,
        );
      }
      const svc = serviceMap.get(serviceId);
      return NextResponse.json(
        {
          error: `Estas fechas ya no están disponibles para ${svc?.titulo || serviceId}. Elige otras.`,
          service_id: serviceId,
        },
        { status: 409 },
      );
    }
  }

  const bookingRows = service_ids.map((serviceId) => {
    const svc = serviceMap.get(serviceId);
    const ctx = contextByServiceId.get(serviceId);
    return buildBookingRow({
      svc,
      userId,
      fechaInicio: ctx.fecha_inicio,
      fechaFin: ctx.fecha_fin,
      hora: ctx.hora,
      duracionHoras: ctx.duracion_horas,
      mensaje,
      precioBase: precioBasePorServicioMap.get(serviceId),
      precioTotal: precioPorServicioMap.get(serviceId),
      clienteSinComision,
      creditoAplicado: creditoPorServicioMap.get(serviceId) ?? 0,
      grupoReserva: grupo_reserva,
      paymentIntentId:
        paymentsByService.get(serviceId) ?? ctx.payment_intent_id ?? null,
      familiaId: familia_id,
      numHuespedes: numHuespedesPorServicio.get(serviceId) ?? null,
      modalidadCobro: modalidadPorServicioMap.get(serviceId),
      lugarServicio: ctx.lugar_servicio ?? null,
      direccionCliente: ctx.direccion_cliente ?? null,
      direccionClienteADefinir: ctx.direccion_cliente_a_definir ?? null,
    });
  });

  const { data: insertedBookings, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert(bookingRows)
    .select("id, service_id, fecha_inicio, fecha_fin, lugar_servicio, direccion_cliente_a_definir");

  if (insertError) {
    try {
      await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
    } catch (releaseErr) {
      console.error(
        "[bookings/complete] Error liberando crédito tras fallo insert:",
        releaseErr?.message ?? releaseErr,
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await syncClienteContactsForInsertedBookings(
    insertedBookings,
    contextByServiceId,
    serviceMap,
  );

  const insertedBookingIds = insertedBookings.map((b) => b.id);
  const rollbackPaymentIntentId =
    [...paymentsByService.values()].find((pi) => typeof pi === "string") ?? null;

  // Fechas del main solo para emails de grupo; disponibilidad usa fechas de cada booking.
  const mainCtx = contextByServiceId.get(main_service_id);

  return finalizeInsertedBookings({
    userId,
    perfilCliente,
    clienteSinComision,
    creditoAplicado,
    creditoPorServicioMap,
    creditoIdempotencyKey,
    insertedBookings,
    insertedBookingIds,
    rollbackPaymentIntentId,
    fechaInicio: mainCtx?.fecha_inicio ?? fecha_inicio,
    fechaFin: mainCtx?.fecha_fin ?? fecha_fin,
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

    const dniCheck = await assertUserIsDniVerified(supabaseAdmin, userId);
    if (!dniCheck.ok) {
      return NextResponse.json(dniCheck.body, { status: dniCheck.status });
    }

    const telefonoCheck = await assertUserHasTelefono(supabaseAdmin, userId);
    if (!telefonoCheck.ok) {
      return NextResponse.json(telefonoCheck.body, {
        status: telefonoCheck.status,
      });
    }

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
      num_huespedes = null,
      modalidad_cobro = null,
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

    const { data: servicesRaw, error: servicesError } = await supabaseAdmin
      .from("services")
      .select(SERVICE_SELECT)
      .in("id", uniqueServiceIds);

    if (servicesError) {
      return NextResponse.json(
        { error: servicesError.message },
        { status: 500 },
      );
    }

    if (!servicesRaw || servicesRaw.length !== uniqueServiceIds.length) {
      const foundIds = new Set(servicesRaw?.map((s) => s.id) ?? []);
      const missing = uniqueServiceIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: "Algunos servicios no existen", missing_service_ids: missing },
        { status: 400 },
      );
    }

    const servicesWithMods = await attachModalidadesToServices(servicesRaw);
    const services = await attachContactsToServicesAdmin(
      servicesWithMods,
      supabaseAdmin,
    );
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

    const contextsResolved = resolveServiceContextsById(body, uniqueServiceIds, {
      fecha_inicio,
      fecha_fin,
      hora,
      duracion_horas,
      modalidad_cobro,
      num_huespedes,
    });
    if (!contextsResolved.ok) return contextsResolved.response;
    const contextByServiceId = contextsResolved.map;

    const numHuespedesRawMap = new Map(
      [...contextByServiceId.entries()].map(([id, ctx]) => [
        id,
        ctx.num_huespedes,
      ]),
    );
    const huespedesResolved = resolveNumHuespedesPorServicio(
      services,
      numHuespedesRawMap,
    );
    if (!huespedesResolved.ok) return huespedesResolved.response;
    const numHuespedesPorServicio = huespedesResolved.map;

    const { data: perfilCliente, error: perfilError } = await supabaseAdmin
      .from("profiles")
      .select("reservas_sin_comision_cliente, nombre")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 500 });
    }

    const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;

    const priced = await computePreciosPorServicioConContextos({
      serviceIds: service_ids,
      serviceMap,
      contextByServiceId,
      numHuespedesPorServicio,
      clienteSinComision,
    });
    if (!priced.ok) return priced.response;

    const { preciosPorServicio } = priced;
    const subtotalGrupo = priced.subtotalGrupo;
    const comision = clienteSinComision
      ? 0
      : roundMoney(subtotalGrupo * COMMISSION_RATE);
    const totalGrupo = roundMoney(subtotalGrupo + comision);

    const topeCredito = roundMoney(totalGrupo * MAX_CREDITO_PORCENTAJE);

    const precioPorServicioMap = new Map(
      preciosPorServicio.map((p) => [p.service_id, p.precio_total]),
    );
    const precioBasePorServicioMap = new Map(
      preciosPorServicio.map((p) => [p.service_id, p.precio_base]),
    );
    const modalidadPorServicioMap = new Map(
      preciosPorServicio.map((p) => [p.service_id, p.modalidad_cobro ?? null]),
    );

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

    // Idempotencia por grupo / PI antes del débito.
    const { data: existingByGrupo, error: existingGrupoError } =
      await supabaseAdmin
        .from("bookings")
        .select("id, service_id, payment_intent_id")
        .eq("grupo_reserva", grupo_reserva)
        .eq("cliente_id", userId)
        .in("service_id", uniqueServiceIds);

    if (existingGrupoError) {
      return NextResponse.json(
        { error: existingGrupoError.message },
        { status: 500 },
      );
    }

    if ((existingByGrupo ?? []).length > 0) {
      const existingServiceIds = new Set(
        existingByGrupo.map((b) => b.service_id),
      );
      const allPresent = uniqueServiceIds.every((id) =>
        existingServiceIds.has(id),
      );
      if (allPresent) {
        return NextResponse.json({
          ok: true,
          already_created: true,
          booking_ids: existingByGrupo.map((b) => b.id),
          grupo_reserva,
        });
      }
      return NextResponse.json(
        {
          error:
            "Estado inconsistente: algunas reservas del grupo ya existen y otras no",
        },
        { status: 409 },
      );
    }

    const { data: existingByPi, error: existingPiError } = await supabaseAdmin
      .from("bookings")
      .select("id, payment_intent_id, grupo_reserva")
      .eq("payment_intent_id", payment_intent_id)
      .limit(1);

    if (existingPiError) {
      return NextResponse.json(
        { error: existingPiError.message },
        { status: 500 },
      );
    }

    if ((existingByPi ?? []).length > 0) {
      return NextResponse.json(
        {
          error: `payment_intent_id ${payment_intent_id} ya está asociado a otra reserva`,
        },
        { status: 409 },
      );
    }

    const creditoIdempotencyKey = `complete:pi:${payment_intent_id}`;
    let creditoAplicado = 0;
    try {
      creditoAplicado = await debitCreditoDisponible(
        supabaseAdmin,
        userId,
        topeCredito,
        creditoIdempotencyKey,
      );
    } catch (debitErr) {
      console.error(
        "[bookings/complete] Error en débito atómico de crédito:",
        debitErr?.message ?? debitErr,
      );
      return NextResponse.json(
        { error: debitErr?.message || "Error al aplicar crédito" },
        { status: 500 },
      );
    }

    const totalAPagar = roundMoney(totalGrupo - creditoAplicado);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    } catch (piErr) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras fallo PI:",
          releaseErr?.message ?? releaseErr,
        );
      }
      throw piErr;
    }

    if (paymentIntent.metadata?.cliente_id !== userId) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras PI ajeno:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        { error: "El pago no pertenece a este usuario" },
        { status: 403 },
      );
    }

    if (paymentIntent.metadata?.grupo_reserva !== grupo_reserva) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras grupo mismatch:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        { error: "grupo_reserva no coincide con el pago" },
        { status: 400 },
      );
    }

    const validStatuses = ["requires_capture", "succeeded"];
    if (!validStatuses.includes(paymentIntent.status)) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras PI no confirmado:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        { error: "El pago no está confirmado" },
        { status: 400 },
      );
    }

    const expectedAmountCents = Math.round(totalAPagar * 100);
    const amountDiff = Math.abs(paymentIntent.amount - expectedAmountCents);
    if (amountDiff > 2) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras importe mismatch:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json(
        { error: "El importe del pago no coincide" },
        { status: 400 },
      );
    }

    const creditoPorServicioMap = splitCreditoPorServicio(
      preciosPorServicio,
      creditoAplicado,
      totalGrupo,
    );

    for (const serviceId of uniqueServiceIds) {
      const ctx = contextByServiceId.get(serviceId);
      let solapamiento;
      try {
        solapamiento = await hasDisponibilidadSolapamiento(
          serviceId,
          ctx.fecha_inicio,
          ctx.fecha_fin || ctx.fecha_inicio,
        );
      } catch (overlapError) {
        try {
          await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
        } catch (releaseErr) {
          console.error(
            "[bookings/complete] Error liberando crédito tras solapamiento:",
            releaseErr?.message ?? releaseErr,
          );
        }
        return NextResponse.json(
          { error: overlapError.message, service_id: serviceId },
          { status: 500 },
        );
      }

      if (solapamiento) {
        try {
          await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
        } catch (releaseErr) {
          console.error(
            "[bookings/complete] Error liberando crédito tras fechas ocupadas:",
            releaseErr?.message ?? releaseErr,
          );
        }
        const svc = serviceMap.get(serviceId);
        return NextResponse.json(
          {
            error: `Estas fechas ya no están disponibles para ${svc?.titulo || serviceId}. Elige otras.`,
            service_id: serviceId,
          },
          { status: 409 },
        );
      }
    }

    const bookingRows = service_ids.map((serviceId) => {
      const svc = serviceMap.get(serviceId);
      const ctx = contextByServiceId.get(serviceId);
      return buildBookingRow({
        svc,
        userId,
        fechaInicio: ctx.fecha_inicio,
        fechaFin: ctx.fecha_fin,
        hora: ctx.hora,
        duracionHoras: ctx.duracion_horas,
        mensaje,
        precioBase: precioBasePorServicioMap.get(serviceId),
        precioTotal: precioPorServicioMap.get(serviceId),
        clienteSinComision,
        creditoAplicado: creditoPorServicioMap.get(serviceId) ?? 0,
        grupoReserva: grupo_reserva,
        paymentIntentId: payment_intent_id,
        familiaId: familia_id,
        numHuespedes: numHuespedesPorServicio.get(serviceId) ?? null,
        modalidadCobro: modalidadPorServicioMap.get(serviceId),
        lugarServicio: ctx.lugar_servicio ?? null,
        direccionCliente: ctx.direccion_cliente ?? null,
        direccionClienteADefinir: ctx.direccion_cliente_a_definir ?? null,
      });
    });

    const { data: insertedBookings, error: insertError } = await supabaseAdmin
      .from("bookings")
      .insert(bookingRows)
      .select("id, service_id, fecha_inicio, fecha_fin, lugar_servicio, direccion_cliente_a_definir");

    if (insertError) {
      try {
        await releaseCreditoDebito(supabaseAdmin, creditoIdempotencyKey);
      } catch (releaseErr) {
        console.error(
          "[bookings/complete] Error liberando crédito tras fallo insert:",
          releaseErr?.message ?? releaseErr,
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await syncClienteContactsForInsertedBookings(
      insertedBookings,
      contextByServiceId,
      serviceMap,
    );

    const insertedBookingIds = insertedBookings.map((b) => b.id);

    return finalizeInsertedBookings({
      userId,
      perfilCliente,
      clienteSinComision,
      creditoAplicado,
      creditoPorServicioMap,
      creditoIdempotencyKey,
      insertedBookings,
      insertedBookingIds,
      rollbackPaymentIntentId: payment_intent_id,
      fechaInicio:
        contextByServiceId.get(main_service_id)?.fecha_inicio ?? fecha_inicio,
      fechaFin:
        contextByServiceId.get(main_service_id)?.fecha_fin ?? fecha_fin,
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
  } catch (error) {
    console.error("[bookings/complete]", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 },
    );
  }
}
