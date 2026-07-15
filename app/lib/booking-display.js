/** Helpers compartidos para historial y detalle de reserva. */

export const BOOKING_STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#c47d1a", label: "Pendiente" },
  confirmada: { bg: "#e8f0fb", color: "#1d4f91", label: "Confirmada" },
  en_curso: { bg: "#ede9fe", color: "#7c3aed", label: "En curso" },
  completada: { bg: "#e6f4f0", color: "#0e7a5c", label: "Completada" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencia" },
  cancelada: { bg: "#fee2e2", color: "#dc2626", label: "Cancelada" },
  cancelada_garantia: { bg: "#fee2e2", color: "#dc2626", label: "Cancelada" },
  rechazada: { bg: "#f3f4f6", color: "#6b7280", label: "Rechazada" },
};

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
