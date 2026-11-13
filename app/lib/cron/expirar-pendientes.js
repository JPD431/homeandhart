import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { RESOLUCION_EXPIRADA_SIN_RESPUESTA } from "@/app/lib/booking-display";
import { cancelPaymentIntentOnReject } from "@/app/lib/cancel-payment-intent-on-reject";
import { devolverCreditoReservaPendiente } from "@/app/lib/devolver-credito-reserva-pendiente";
import { notifyBookingEvent } from "@/app/lib/notifications";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

/** Horas sin respuesta del proveedor antes de caducar una reserva pendiente. */
export const EXPIRAR_PENDIENTES_HORAS = 48;
/** Máximo de reservas a procesar por ejecución del cron. */
export const EXPIRAR_PENDIENTES_LIMIT = 50;

/**
 * Estado final: reutilizamos «rechazada» (válido en todo el código; sin CHECK
 * que lo impida). Distinción vs rechazo manual del proveedor:
 *   resolucion_tipo = RESOLUCION_EXPIRADA_SIN_RESPUESTA
 *   resolucion_nota = texto fijo del cron
 */
export const EXPIRAR_ESTADO = "rechazada";
export const EXPIRAR_RESOLUCION_TIPO = RESOLUCION_EXPIRADA_SIN_RESPUESTA;
export const EXPIRAR_RESOLUCION_NOTA =
  "Caducada automáticamente: el proveedor no respondió a tiempo";

export function todayUtcDateString(now = new Date()) {
  return now.toISOString().split("T")[0];
}

export function cutoffCreatedAtIso(
  now = new Date(),
  hours = EXPIRAR_PENDIENTES_HORAS,
) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Filtro `.or()` INCORRECTO (bug histórico): un ISO con `:` dentro de `or=()`
 * usa caracteres reservados de PostgREST y el filtro no matchea filas.
 * Se exporta solo para el test de regresión.
 */
export function buildBrokenExpirarPendientesOrFilter(cutoffIso, hoyUtc) {
  return `created_at.lt.${cutoffIso},fecha_inicio.lt.${hoyUtc}`;
}

/**
 * Simula el parseo de PostgREST de un valor sin comillas dentro de or=():
 * el valor se corta en el primer `:`.
 */
export function postgrestUnquotedOrValueAfterLt(orExpr, column) {
  const prefix = `${column}.lt.`;
  const idx = orExpr.indexOf(prefix);
  if (idx < 0) return null;
  let rest = orExpr.slice(idx + prefix.length);
  const comma = rest.indexOf(",");
  if (comma >= 0) rest = rest.slice(0, comma);
  if (rest.startsWith('"')) {
    const end = rest.indexOf('"', 1);
    return end >= 0 ? rest.slice(1, end) : rest.slice(1);
  }
  const colon = rest.indexOf(":");
  return colon >= 0 ? rest.slice(0, colon) : rest;
}

const CANDIDATE_SELECT =
  "id, service_id, cliente_id, payment_intent_id, estado, fecha_inicio, fecha_fin, precio_total, credito_aplicado, created_at";

/**
 * Candidatas a expirar: pendientes con created_at < cutoff O fecha_inicio < hoy.
 *
 * No usamos `.or(created_at.lt.<ISO>,…)`: los `:` del ISO son reservados en
 * `or=()` de PostgREST y el filtro devolvía 0 filas en silencio.
 * Dos queries con `.lt()` (param separado) son fiables.
 */
export async function fetchPendientesExpirables(
  supabaseAdmin,
  { cutoffIso, hoy, limit = EXPIRAR_PENDIENTES_LIMIT } = {},
) {
  const [byAge, byFecha] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(CANDIDATE_SELECT)
      .eq("estado", "pendiente")
      .lt("created_at", cutoffIso)
      .order("created_at", { ascending: true })
      .limit(limit),
    supabaseAdmin
      .from("bookings")
      .select(CANDIDATE_SELECT)
      .eq("estado", "pendiente")
      .lt("fecha_inicio", hoy)
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);

  if (byAge.error) {
    throw new Error(byAge.error.message || String(byAge.error));
  }
  if (byFecha.error) {
    throw new Error(byFecha.error.message || String(byFecha.error));
  }

  const byId = new Map();
  for (const row of [...(byAge.data ?? []), ...(byFecha.data ?? [])]) {
    if (row?.id) byId.set(row.id, row);
  }

  return Array.from(byId.values())
    .sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || "")),
    )
    .slice(0, limit);
}

async function postBookingEmail(payload) {
  try {
    const result = await sendPlatformEmail(payload);
    if (!result.ok) {
      console.error(
        "[cron/expirar-pendientes] FALLO email (flujo NO abortado)",
        `tipo=${payload?.tipo || "?"}`,
        `status=${result.status ?? "?"}`,
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error(
      "[cron/expirar-pendientes] EXCEPCIÓN email (flujo NO abortado)",
      payload?.tipo,
      err,
    );
  }
}

/**
 * @param {{
 *   supabaseAdmin?: import("@supabase/supabase-js").SupabaseClient,
 *   stripe?: import("stripe").Stripe,
 *   now?: Date,
 *   limit?: number,
 *   cancelPayment?: typeof cancelPaymentIntentOnReject,
 *   devolverCredito?: typeof devolverCreditoReservaPendiente,
 *   notify?: typeof notifyBookingEvent,
 *   sendEmail?: typeof postBookingEmail,
 * }} [deps]
 */
export async function runExpirarPendientes(deps = {}) {
  const now = deps.now ?? new Date();
  const limit = deps.limit ?? EXPIRAR_PENDIENTES_LIMIT;
  const supabaseAdmin =
    deps.supabaseAdmin ??
    createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  const stripe =
    deps.stripe ?? new Stripe(process.env.STRIPE_SECRET_KEY);
  const cancelPayment = deps.cancelPayment ?? cancelPaymentIntentOnReject;
  const devolverCredito =
    deps.devolverCredito ?? devolverCreditoReservaPendiente;
  const notify = deps.notify ?? notifyBookingEvent;
  const sendEmail = deps.sendEmail ?? postBookingEmail;

  const hoy = todayUtcDateString(now);
  const cutoffIso = cutoffCreatedAtIso(now);

  const candidates = await fetchPendientesExpirables(supabaseAdmin, {
    cutoffIso,
    hoy,
    limit,
  });

  const stats = {
    scanned: candidates.length,
    expired: 0,
    skipped: 0,
    reverted: 0,
    errors: [],
    cutoff_iso: cutoffIso,
    hoy,
  };

  for (const booking of candidates ?? []) {
    try {
      const result = await expireOneBooking(booking, {
        supabaseAdmin,
        stripe,
        cancelPayment,
        devolverCredito,
        notify,
        sendEmail,
        now,
      });
      if (result === "expired") stats.expired += 1;
      else if (result === "skipped") stats.skipped += 1;
      else if (result === "reverted") stats.reverted += 1;
    } catch (err) {
      const msg = err?.message || String(err);
      console.error(
        "[cron/expirar-pendientes] Error procesando reserva:",
        booking.id,
        msg,
      );
      stats.errors.push(`${booking.id}:${msg}`);
    }
  }

  return stats;
}

async function expireOneBooking(
  booking,
  {
    supabaseAdmin,
    stripe,
    cancelPayment,
    devolverCredito,
    notify,
    sendEmail,
    now,
  },
) {
  const resolucionAt = (now ?? new Date()).toISOString();

  // Claim atómico: solo gana si sigue pendiente (como respond).
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({
      estado: EXPIRAR_ESTADO,
      resolucion_tipo: EXPIRAR_RESOLUCION_TIPO,
      resolucion_nota: EXPIRAR_RESOLUCION_NOTA,
      resolucion_at: resolucionAt,
    })
    .eq("id", booking.id)
    .eq("estado", "pendiente")
    .select("id, estado");

  if (claimError) {
    throw new Error(claimError.message);
  }

  const wonClaim = Array.isArray(claimedRows) && claimedRows.length > 0;
  if (!wonClaim) {
    return "skipped";
  }

  const cancelResult = await cancelPayment(
    {
      id: booking.id,
      payment_intent_id: booking.payment_intent_id,
      precio_total: booking.precio_total,
      credito_aplicado: booking.credito_aplicado,
    },
    {
      stripe,
      supabaseAdmin,
      idempotencyKey: `cancel-pi:expirar-pendiente:${booking.id}`,
    },
  );

  if (!cancelResult?.ok) {
    console.error(
      "[cron/expirar-pendientes] Fallo liberando pago; revirtiendo a pendiente:",
      booking.id,
      cancelResult?.error,
      { pi_status: cancelResult?.pi_status },
    );

    const { error: revertError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "pendiente",
        resolucion_tipo: null,
        resolucion_nota: null,
        resolucion_at: null,
      })
      .eq("id", booking.id)
      .eq("estado", EXPIRAR_ESTADO)
      .eq("resolucion_tipo", EXPIRAR_RESOLUCION_TIPO);

    if (revertError) {
      throw new Error(
        `No se pudo revertir a pendiente tras fallo de pago: ${revertError.message}`,
      );
    }

    return "reverted";
  }

  try {
    await devolverCredito(
      supabaseAdmin,
      booking,
      "[cron/expirar-pendientes]",
    );
  } catch (creditErr) {
    console.error(
      "[cron/expirar-pendientes] Error devolviendo crédito:",
      creditErr?.message ?? creditErr,
      { bookingId: booking.id },
    );
  }

  try {
    const { error: disponibilidadError } = await supabaseAdmin
      .from("disponibilidad")
      .delete()
      .eq("booking_id", booking.id);
    if (disponibilidadError) {
      console.error(
        "[cron/expirar-pendientes] No se pudo liberar disponibilidad:",
        disponibilidadError,
        { bookingId: booking.id },
      );
    }
  } catch (dispErr) {
    console.error(
      "[cron/expirar-pendientes] No se pudo liberar disponibilidad:",
      dispErr,
      { bookingId: booking.id },
    );
  }

  await notifyAndEmailExpired(booking, {
    supabaseAdmin,
    notify,
    sendEmail,
  });

  return "expired";
}

async function notifyAndEmailExpired(
  booking,
  { supabaseAdmin, notify, sendEmail },
) {
  const { data: serviceRaw, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id, titulo")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    console.error(
      "[cron/expirar-pendientes] Error cargando servicio:",
      serviceError,
      { bookingId: booking.id },
    );
  }

  const service = serviceRaw;
  const proveedorId = service?.proveedor_id ?? null;
  const servicioTitulo = service?.titulo || "Servicio";
  const finEmail = booking.fecha_fin || booking.fecha_inicio;

  const [
    { data: proveedorProfile },
    { data: clienteProfile },
  ] = await Promise.all([
    proveedorId
      ? supabaseAdmin
          .from("profiles")
          .select("nombre, apellido")
          .eq("id", proveedorId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    booking.cliente_id
      ? supabaseAdmin
          .from("profiles")
          .select("nombre, apellido")
          .eq("id", booking.cliente_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const proveedorNombre =
    [proveedorProfile?.nombre, proveedorProfile?.apellido]
      .filter(Boolean)
      .join(" ") || "Proveedor";
  const clienteNombre =
    [clienteProfile?.nombre, clienteProfile?.apellido]
      .filter(Boolean)
      .join(" ") || undefined;

  if (booking.cliente_id) {
    await sendEmail({
      tipo: "reserva_expirada",
      cliente_id: booking.cliente_id,
      cliente_nombre: clienteNombre,
      proveedor_nombre: proveedorNombre,
      servicio_titulo: servicioTitulo,
      fecha_inicio: booking.fecha_inicio,
      fecha_fin: finEmail,
      precio_total: Number(booking.precio_total || 0).toFixed(2),
      booking_id: booking.id,
    });

    const clientNotif = await notify(supabaseAdmin, {
      tipo: "reserva_expirada_cliente",
      bookingId: booking.id,
      clienteId: booking.cliente_id,
      proveedorNombre,
      servicioTitulo,
      fechaInicio: booking.fecha_inicio,
      fechaFin: finEmail,
    });
    if (!clientNotif?.ok) {
      console.error(
        "[cron/expirar-pendientes] Notificación cliente NO creada:",
        clientNotif,
        { bookingId: booking.id },
      );
    }
  }

  if (proveedorId) {
    const providerNotif = await notify(supabaseAdmin, {
      tipo: "reserva_expirada_proveedor",
      bookingId: booking.id,
      proveedorId,
      clienteNombre,
      servicioTitulo,
      fechaInicio: booking.fecha_inicio,
      fechaFin: finEmail,
    });
    if (!providerNotif?.ok) {
      console.error(
        "[cron/expirar-pendientes] Notificación proveedor NO creada:",
        providerNotif,
        { bookingId: booking.id },
      );
    }
  }
}
