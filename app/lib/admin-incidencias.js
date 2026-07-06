import Stripe from "stripe";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const VERTICAL_LABELS = {
  alojamiento: "Alojamiento",
  ninos: "Niñera",
  mascotas: "Mascotas",
};

export const PI_STATUS_LABELS = {
  requires_capture: "Retenido (sin capturar)",
  requires_confirmation: "Pendiente de confirmación",
  requires_action: "Requiere acción",
  requires_payment_method: "Sin método de pago",
  processing: "Procesando",
  succeeded: "Capturado",
  canceled: "Cancelado",
};

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || "—";
}

export function inferReporterRol(report, booking, proveedorId) {
  if (!report?.reporter_id) return "desconocido";
  if (report.reporter_id === booking.cliente_id) return "cliente";
  if (report.reporter_id === proveedorId) return "proveedor";
  return "desconocido";
}

export async function fetchStripePaymentIntentSummary(paymentIntentId) {
  if (!paymentIntentId) {
    return {
      id: null,
      status: null,
      status_label: "Sin PaymentIntent",
      amount_authorized_eur: null,
      amount_captured_eur: null,
      currency: "eur",
      error: null,
    };
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const amountAuthorized = pi.amount != null ? pi.amount / 100 : null;
    const amountCaptured =
      pi.amount_received != null ? pi.amount_received / 100 : null;

    return {
      id: pi.id,
      status: pi.status,
      status_label: PI_STATUS_LABELS[pi.status] ?? pi.status,
      amount_authorized_eur: amountAuthorized,
      amount_captured_eur: amountCaptured,
      currency: pi.currency,
      error: null,
    };
  } catch (err) {
    return {
      id: paymentIntentId,
      status: null,
      status_label: "Error al consultar Stripe",
      amount_authorized_eur: null,
      amount_captured_eur: null,
      currency: "eur",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function buildBundleInfo(supabaseAdmin, booking) {
  const paymentIntentId = booking.payment_intent_id;
  if (!paymentIntentId) {
    return {
      is_bundle: false,
      shared_payment_intent_id: null,
      sibling_count: 0,
      siblings: [],
      bundle_note: null,
    };
  }

  const { data: relatedBookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      estado,
      service_id,
      services:service_id (titulo, vertical)
    `,
    )
    .eq("payment_intent_id", paymentIntentId);

  if (error) {
    return {
      is_bundle: false,
      shared_payment_intent_id: paymentIntentId,
      sibling_count: 0,
      siblings: [],
      bundle_note: `No se pudo comprobar el bundle: ${error.message}`,
    };
  }

  const all = relatedBookings ?? [];
  const siblings = all.filter((row) => row.id !== booking.id);
  const isBundle = all.length > 1;

  return {
    is_bundle: isBundle,
    shared_payment_intent_id: paymentIntentId,
    sibling_count: siblings.length,
    siblings: siblings.map((row) => ({
      id: row.id,
      estado: row.estado,
      titulo: row.services?.titulo || "Servicio",
      vertical: row.services?.vertical || "—",
      vertical_label: VERTICAL_LABELS[row.services?.vertical] ?? row.services?.vertical,
    })),
    bundle_note: isBundle
      ? "Esta reserva comparte PaymentIntent con otras del bundle. La resolución futura afectará SOLO a este servicio/vertical, no al resto."
      : null,
  };
}

export function mapIncidenciaRow(booking, report, stripePi, bundleInfo) {
  const service = booking.services ?? {};
  const proveedor = service.profiles_public ?? {};
  const cliente = booking.profiles_public ?? {};
  const proveedorId = service.proveedor_id ?? null;

  return {
    id: booking.id,
    estado: booking.estado,
    fecha_inicio: booking.fecha_inicio,
    fecha_fin: booking.fecha_fin,
    hora: booking.hora,
    precio_total: Number(booking.precio_total) || 0,
    credito_aplicado: Number(booking.credito_aplicado) || 0,
    ingreso_proveedor_estimado: getIngresoProveedorFromBooking(booking),
    payment_intent_id: booking.payment_intent_id,
    pago_liberado_at: booking.pago_liberado_at,
    servicio: {
      id: booking.service_id,
      titulo: service.titulo || "Servicio",
      vertical: service.vertical || "—",
      vertical_label: VERTICAL_LABELS[service.vertical] ?? service.vertical,
      ciudad: service.ciudad || null,
    },
    cliente: {
      id: booking.cliente_id,
      nombre: fullName(cliente),
    },
    proveedor: {
      id: proveedorId,
      nombre: fullName(proveedor),
    },
    reporte: report
      ? {
          id: report.id,
          motivo: report.motivo,
          descripcion: report.descripcion,
          estado: report.estado,
          created_at: report.created_at,
          reporter_rol: inferReporterRol(report, booking, proveedorId),
          reporter_nombre: fullName(report.reporter),
        }
      : null,
    stripe: stripePi,
    bundle: bundleInfo,
    incidencia_desde:
      report?.created_at || booking.completada_at || booking.created_at,
  };
}
