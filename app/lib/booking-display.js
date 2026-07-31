/** Helpers compartidos para historial, detalle y dashboard de reserva. */

import { getBookingPrecioBase, roundMoney } from "@/app/lib/ingresos-proveedor";
import { COMMISSION_RATE } from "@/app/lib/pricing-reserva";
import { puedeReportarIncidencia } from "@/app/lib/booking-incidencia";

/**
 * Catálogo central de estados: etiqueta humana, color y significado.
 * `actions*` = ids de acciones posibles (la UI decide botones concretos).
 */
const BOOKING_STATUS_CATALOG = {
  pendiente: {
    label: "Pendiente de confirmación",
    bg: "#fef3c7",
    color: "#92400e",
    descriptionCliente:
      "El proveedor aún no ha respondido. Puedes esperar o cancelar la reserva.",
    descriptionProveedor:
      "Tienes una solicitud nueva. Acéptala o recházala para que el cliente sepa qué hacer.",
    actionsCliente: ["ver_detalle", "cancelar", "mensaje"],
    actionsProveedor: ["ver_detalle", "aceptar", "rechazar", "mensaje"],
  },
  confirmada: {
    label: "Confirmada",
    bg: "#e8f0fb",
    color: "#1d4f91",
    descriptionCliente:
      "Tu reserva está confirmada. Cuando termine el servicio, podrás confirmarlo o reportar un problema.",
    descriptionProveedor:
      "Reserva aceptada. Coordina con el cliente; si no puedes cumplirla, cancélala cuanto antes.",
    actionsCliente: [
      "ver_detalle",
      "cancelar",
      "completar",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
    actionsProveedor: [
      "ver_detalle",
      "cancelar",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
  },
  en_curso: {
    label: "Servicio en curso",
    bg: "#fef3c7",
    color: "#92400e",
    descriptionCliente:
      "El servicio está en curso. Cuando termine, podrás confirmarlo o se completará automáticamente.",
    descriptionProveedor:
      "El servicio está en curso. Al finalizar, el cliente puede confirmarlo o se completará solo.",
    actionsCliente: [
      "ver_detalle",
      "completar",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
    actionsProveedor: [
      "ver_detalle",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
  },
  completada: {
    label: "Completada",
    bg: "#e6f4f0",
    color: "#0e7a5c",
    descriptionCliente:
      "Servicio finalizado. Puedes descargar la factura, dejar una reseña o reportar un problema si algo falló.",
    descriptionProveedor:
      "Servicio completado. El pago se libera según el flujo de la plataforma.",
    actionsCliente: [
      "ver_detalle",
      "factura",
      "reseña",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
    actionsProveedor: [
      "ver_detalle",
      "reportar_incidencia",
      "mensaje",
      "contacto",
    ],
  },
  cancelada: {
    label: "Cancelada",
    bg: "#fee2e2",
    color: "#dc2626",
    descriptionCliente:
      "Esta reserva fue cancelada. Si aplica, verás el reembolso o crédito en el detalle.",
    descriptionProveedor:
      "Esta reserva fue cancelada. Las fechas quedan liberadas.",
    actionsCliente: ["ver_detalle", "buscar"],
    actionsProveedor: ["ver_detalle"],
  },
  cancelada_garantia: {
    label: "Cancelada (garantía)",
    bg: "#fee2e2",
    color: "#dc2626",
    descriptionCliente:
      "Cancelada bajo la garantía Home&Heart. Revisa el detalle por el reembolso o crédito.",
    descriptionProveedor:
      "Cancelada bajo la garantía Home&Heart. Las fechas quedan liberadas.",
    actionsCliente: ["ver_detalle", "buscar"],
    actionsProveedor: ["ver_detalle"],
  },
  cancelada_proveedor: {
    label: "Cancelada por el proveedor",
    bg: "#fee2e2",
    color: "#dc2626",
    descriptionCliente:
      "El proveedor canceló la reserva. Busca otra opción o contacta con soporte si lo necesitas.",
    descriptionProveedor:
      "Cancelaste esta reserva. El cliente recibe el reembolso según la política.",
    labelProveedor: "Cancelada por ti",
    actionsCliente: ["ver_detalle", "buscar"],
    actionsProveedor: ["ver_detalle"],
  },
  incidencia: {
    label: "Incidencia",
    bg: "#fee2e2",
    color: "#b91c1c",
    descriptionCliente:
      "Hay un problema reportado. Nuestro equipo lo está revisando; te contactaremos pronto.",
    descriptionProveedor:
      "Hay una incidencia abierta. El pago queda retenido hasta que el equipo la resuelva.",
    actionsCliente: ["ver_detalle", "mensaje"],
    actionsProveedor: ["ver_detalle", "mensaje"],
  },
  incidencia_resuelta: {
    label: "Incidencia resuelta",
    bg: "#f3f4f6",
    color: "#4b5563",
    descriptionCliente:
      "La incidencia ya fue resuelta por el equipo. Revisa el detalle si necesitas más información.",
    descriptionProveedor:
      "La incidencia ya fue resuelta. Revisa el detalle para el resultado del caso.",
    actionsCliente: ["ver_detalle"],
    actionsProveedor: ["ver_detalle"],
  },
  rechazada: {
    label: "Rechazada",
    bg: "#f3f4f6",
    color: "#6b7280",
    descriptionCliente:
      "El proveedor no pudo aceptar esta reserva. Puedes buscar alternativas.",
    descriptionProveedor: "Rechazaste esta solicitud. El pago del cliente se liberó.",
    actionsCliente: ["ver_detalle", "buscar"],
    actionsProveedor: ["ver_detalle"],
  },
};

/** @deprecated Prefer getBookingStatusMeta — mantenido por compatibilidad. */
export const BOOKING_STATUS_STYLES = Object.fromEntries(
  Object.entries(BOOKING_STATUS_CATALOG).map(([key, meta]) => [
    key,
    { bg: meta.bg, color: meta.color, label: meta.label },
  ]),
);

/**
 * Meta de estado para UI: label + color + descripción + acciones.
 * @param {string | { estado?: string, status?: string } | null | undefined} estadoOrBooking
 * @param {{ role?: 'cliente' | 'proveedor' }} [options]
 */
export function getBookingStatusMeta(estadoOrBooking, { role = "cliente" } = {}) {
  const raw =
    typeof estadoOrBooking === "object" && estadoOrBooking != null
      ? (estadoOrBooking.estado ?? estadoOrBooking.status)
      : estadoOrBooking;
  const key = raw || "pendiente";
  const entry = BOOKING_STATUS_CATALOG[key] || {
    label: key.replace(/_/g, " "),
    bg: "#f3f4f6",
    color: "#6b7280",
    descriptionCliente: "Estado de la reserva.",
    descriptionProveedor: "Estado de la reserva.",
    actionsCliente: ["ver_detalle"],
    actionsProveedor: ["ver_detalle"],
  };

  const isProveedor = role === "proveedor";
  const label =
    isProveedor && entry.labelProveedor ? entry.labelProveedor : entry.label;
  const description = isProveedor
    ? entry.descriptionProveedor
    : entry.descriptionCliente;
  let actions = [
    ...(isProveedor ? entry.actionsProveedor : entry.actionsCliente),
  ];

  // Solo ofrecer reportar si el estado lo permite (fuente de verdad server-side).
  if (
    actions.includes("reportar_incidencia") &&
    !puedeReportarIncidencia(key)
  ) {
    actions = actions.filter((a) => a !== "reportar_incidencia");
  }

  return {
    key,
    label,
    bg: entry.bg,
    color: entry.color,
    description,
    actions,
    canReportIncidencia: actions.includes("reportar_incidencia"),
  };
}

export const BOOKING_VERTICAL_META = {
  alojamiento: {
    label: "Alojamiento",
    color: "#1d4f91",
    gradient: "linear-gradient(135deg, #1d4f91, #2a6bb5)",
  },
  ninos: {
    label: "Niñera",
    color: "#0e7a5c",
    gradient: "linear-gradient(135deg, #0e7a5c, #1a9d75)",
  },
  mascotas: {
    label: "Mascotas",
    color: "#c47d1a",
    gradient: "linear-gradient(135deg, #c47d1a, #e09a2e)",
  },
};

export const BOOKING_MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function getBookingEstado(booking) {
  const estado = booking?.estado ?? booking?.status;
  if (estado === "cancelada_garantia") return "cancelada";
  return estado;
}

/** Estados que cuentan como cancelados en filtros de historial. */
export function isCanceladoEstado(estado) {
  return (
    estado === "cancelada" ||
    estado === "cancelada_proveedor" ||
    estado === "cancelada_garantia"
  );
}

/**
 * Desglose de precio para el cliente (lo que pagó / debe pagar).
 * @returns {{
 *   base: number,
 *   gestion: number,
 *   subtotal: number,
 *   credito: number,
 *   total: number,
 *   sinGestion: boolean,
 *   lines: Array<{ label: string, amount: number, muted?: boolean }>,
 * }}
 */
export function getClientPriceBreakdown(booking) {
  const base = getBookingPrecioBase(booking);
  const total = roundMoney(Number(booking?.precio_total) || 0);
  const credito = roundMoney(Number(booking?.credito_aplicado) || 0);
  const sinGestion = booking?.cliente_sin_comision === true;
  const gestion = sinGestion
    ? 0
    : roundMoney(Math.max(0, total - base));
  // Si no hay precio_base y la inferencia no cuadra, mostrar gestión por comisión.
  const gestionFallback =
    !sinGestion && gestion <= 0 && total > 0
      ? roundMoney(base * COMMISSION_RATE)
      : gestion;

  const lines = [
    { label: "Precio del servicio", amount: base },
  ];
  if (!sinGestion && gestionFallback > 0) {
    lines.push({ label: "Gastos de gestión", amount: gestionFallback });
  } else if (sinGestion) {
    lines.push({ label: "Gastos de gestión", amount: 0, muted: true });
  }
  if (credito > 0) {
    lines.push({ label: "Crédito aplicado", amount: -credito });
  }

  const aPagar = roundMoney(Math.max(0, total - credito));

  return {
    base,
    gestion: gestionFallback,
    subtotal: total,
    credito,
    total: aPagar,
    sinGestion,
    lines,
  };
}

export function getLugarServicioLabel(lugarServicio, { viewer = "cliente" } = {}) {
  if (lugarServicio === "casa_proveedor") {
    return viewer === "proveedor"
      ? "En tu domicilio / establecimiento"
      : "En casa del profesional";
  }
  if (lugarServicio === "casa_cliente") {
    return viewer === "proveedor"
      ? "En domicilio del cliente"
      : "En tu casa";
  }
  return null;
}

export function formatBookingPrice(precio) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio).toFixed(2)}€`;
}

/**
 * Leyenda de precio para la vista del cliente (mismo criterio que checkout /reservar).
 * - sin comisión → "Sin gastos de gestión"
 * - con crédito → null (el crédito se explica aparte; no añadir "incluidos")
 * - resto → "gastos de gestión incluidos"
 *
 * @param {{ cliente_sin_comision?: boolean, credito_aplicado?: number|string|null } | null | undefined} booking
 * @returns {{ kind: "incluidos" | "sin_gestion", text: string } | null}
 */
export function getClientPriceFootnote(booking) {
  if (!booking) return null;

  if (booking.cliente_sin_comision === true) {
    return { kind: "sin_gestion", text: "Sin gastos de gestión" };
  }

  const credito = Number(booking.credito_aplicado) || 0;
  if (credito > 0) {
    return null;
  }

  return { kind: "incluidos", text: "gastos de gestión incluidos" };
}

export function formatBookingDateShort(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${BOOKING_MONTH_NAMES[m - 1]?.slice(0, 3) ?? ""}`;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

export function getBookingDurationLabel(booking, vertical) {
  if (vertical === "ninos" && booking.duracion_horas) {
    return `${booking.duracion_horas}h`;
  }
  if (vertical === "alojamiento" || vertical === "mascotas") {
    const days = daysBetween(
      booking.fecha_inicio,
      booking.fecha_fin || booking.fecha_inicio,
    );
    if (days) {
      return `${days} ${days === 1 ? "noche" : vertical === "mascotas" ? "días" : "noches"}`;
    }
  }
  return null;
}

export function getBookingDateRangeLabel(booking) {
  if (!booking.fecha_inicio) return "—";
  const start = formatBookingDateShort(booking.fecha_inicio);
  const end =
    booking.fecha_fin && booking.fecha_fin !== booking.fecha_inicio
      ? formatBookingDateShort(booking.fecha_fin)
      : null;
  if (booking.hora) return `${start} · ${booking.hora}`;
  return end ? `${start} – ${end}` : start;
}

export function getCancelRefundBreakdown(booking) {
  if (getBookingEstado(booking) !== "cancelada") return null;
  if (booking.reembolso_cliente_total == null) return null;

  const precioTotal = Number(booking.precio_total) || 0;
  const reembolsoTotal = Number(booking.reembolso_cliente_total) || 0;
  const reembolsoPct = Number(booking.reembolso_cliente_pct) || 0;
  const reembolsoCredito = Number(booking.reembolso_cliente_credito) || 0;

  return {
    importeFinal: Math.max(0, precioTotal - reembolsoTotal),
    reembolsoTotal,
    reembolsoPct,
    reembolsoCredito,
  };
}

export function canShowProviderContact(estado) {
  return ["confirmada", "en_curso", "completada"].includes(estado);
}

export function getBookingMonthKey(booking) {
  const dateStr = booking.fecha_inicio || booking.created_at?.slice(0, 10);
  if (!dateStr) return "sin-fecha";
  const [y, m] = dateStr.split("-");
  return `${y}-${m}`;
}

export function getBookingMonthLabel(key) {
  if (key === "sin-fecha") return "SIN FECHA";
  const [y, m] = key.split("-").map(Number);
  return `${BOOKING_MONTH_NAMES[m - 1]?.toUpperCase() ?? ""} ${y}`;
}
