/**
 * Criterio de "fechas listas" para desbloquear la sección 3 (servicios adicionales)
 * y mensajes claros cuando falta algo o la hora no es válida.
 *
 * Importante (Safari/WebKit): un <input type="time"> vacío puede *mostrar* 12:30
 * mientras value/estado siguen en "". No dar por válida una hora que no está en estado.
 */

import { needsLugarSelector } from "@/app/lib/lugar-servicio";
import {
  billingNeedsDuracionHoras,
  billingNeedsFechaFin,
  billingNeedsHora,
} from "@/app/lib/pricing-reserva";

/** YYYY-MM-DD en zona local del cliente (no UTC de toISOString). */
export function getLocalTodayStr(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Hora mínima (HH:mm) si `fecha` es hoy en local: ahora + 1 h.
 * Evita el bug de comparar con toISOString().split("T")[0] (UTC).
 */
export function getMinHoraForFecha(fecha, now = new Date()) {
  if (!fecha) return undefined;
  const hoy = getLocalTodayStr(now);
  if (fecha !== hoy) return undefined;
  const min = new Date(now.getTime());
  min.setHours(min.getHours() + 1);
  return `${String(min.getHours()).padStart(2, "0")}:${String(min.getMinutes()).padStart(2, "0")}`;
}

/** Normaliza value de <input type="time"> a HH:mm o "". */
export function normalizeTimeInputValue(value) {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return "";
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) {
    return "";
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hasPositiveDuracion(duracionHoras) {
  if (duracionHoras === "" || duracionHoras == null) return false;
  const n = Number(duracionHoras);
  return Number.isFinite(n) && n > 0;
}

export function timeToMinutes(hora) {
  const normalized = normalizeTimeInputValue(hora);
  if (!normalized) return null;
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/**
 * @returns {null | 'empty' | 'past_min'}
 */
export function getHoraValidity(hora, fechaInicio, now = new Date()) {
  const normalized = normalizeTimeInputValue(hora);
  if (!normalized) return "empty";
  const minHora = getMinHoraForFecha(fechaInicio, now);
  if (!minHora) return null;
  const selected = timeToMinutes(normalized);
  const min = timeToMinutes(minHora);
  if (selected != null && min != null && selected < min) return "past_min";
  return null;
}

/**
 * @typedef {'fechaInicio' | 'fechaFin' | 'hora' | 'duracionHoras' | 'modalidadCobro' | 'lugarServicio'} ReservationDatesGap
 */

/**
 * @param {{
 *   fechaInicio?: string,
 *   fechaFin?: string,
 *   hora?: string,
 *   duracionHoras?: string | number,
 *   vertical?: string,
 *   modalidadCobro?: string | null,
 *   showModalidadSelector?: boolean,
 *   mainBilling?: { kind?: string, modalidad?: string },
 *   serviceModalidad?: string | null,
 *   lugarServicio?: string | null,
 *   now?: Date,
 * }} ctx
 */
export function getReservationDatesStatus(ctx = {}) {
  const {
    fechaInicio = "",
    fechaFin = "",
    hora = "",
    duracionHoras = "",
    vertical = "",
    modalidadCobro = null,
    showModalidadSelector = false,
    mainBilling = { kind: "legacy" },
    serviceModalidad = null,
    lugarServicio = null,
    now = new Date(),
  } = ctx;

  /** @type {ReservationDatesGap[]} */
  const missing = [];
  let horaInvalid = /** @type {null | 'empty' | 'past_min'} */ (null);
  let minHora = undefined;

  if (!fechaInicio) missing.push("fechaInicio");

  if (showModalidadSelector && !modalidadCobro) {
    missing.push("modalidadCobro");
  }

  if (needsLugarSelector(serviceModalidad) && !lugarServicio) {
    missing.push("lugarServicio");
  }

  const billing = mainBilling || { kind: "legacy" };
  const needsHoraField =
    billingNeedsHora(billing) ||
    (billing.kind === "legacy" && vertical === "ninos");
  const needsDuracionField =
    billingNeedsDuracionHoras(billing) ||
    (billing.kind === "legacy" && vertical === "ninos");

  if (billing.kind === "modalidad") {
    if (billingNeedsFechaFin(billing, vertical) && !fechaFin) {
      missing.push("fechaFin");
    }
    if (needsHoraField) {
      const validity = getHoraValidity(hora, fechaInicio, now);
      if (validity === "empty") {
        missing.push("hora");
        horaInvalid = "empty";
      } else if (validity === "past_min") {
        horaInvalid = "past_min";
        minHora = getMinHoraForFecha(fechaInicio, now);
      }
    }
    if (needsDuracionField && !hasPositiveDuracion(duracionHoras)) {
      missing.push("duracionHoras");
    }
  } else if (vertical === "ninos") {
    const validity = getHoraValidity(hora, fechaInicio, now);
    if (validity === "empty") {
      missing.push("hora");
      horaInvalid = "empty";
    } else if (validity === "past_min") {
      horaInvalid = "past_min";
      minHora = getMinHoraForFecha(fechaInicio, now);
    }
    if (!hasPositiveDuracion(duracionHoras)) {
      missing.push("duracionHoras");
    }
  } else if (vertical === "alojamiento" || vertical === "mascotas") {
    if (!fechaFin) missing.push("fechaFin");
  }

  const ready = missing.length === 0 && horaInvalid !== "past_min";

  return {
    ready,
    missing,
    horaInvalid,
    minHora: minHora ?? getMinHoraForFecha(fechaInicio, now),
    normalizedHora: normalizeTimeInputValue(hora),
  };
}

export function areReservationDatesReady(ctx) {
  return getReservationDatesStatus(ctx).ready;
}

/**
 * Mensaje legible para el cliente cuando la sección 3 está bloqueada.
 * @param {ReturnType<typeof getReservationDatesStatus>} status
 * @param {object | null} t — i18n.reservar opcional
 */
export function formatReservationDatesBlockedMessage(status, t = null) {
  if (!status || status.ready) return "";

  if (status.horaInvalid === "past_min" && status.minHora) {
    return t?.errHoraMinima
      ? t.errHoraMinima(status.minHora)
      : `La hora debe ser al menos 1 hora desde ahora. Hora mínima: ${status.minHora}`;
  }

  if (status.missing.includes("hora") || status.horaInvalid === "empty") {
    return (
      t?.seleccionaHoraValida ??
      "Selecciona una hora de inicio (si ves 12:30 y no la elegiste, el campo está vacío: elige la hora de nuevo)."
    );
  }

  if (status.missing.includes("duracionHoras")) {
    return t?.introduceDuracionHoras ?? "Introduce la duración en horas.";
  }

  if (status.missing.includes("modalidadCobro")) {
    return (
      t?.eligeModalidadCobro ?? "Elige cómo quieres reservar este servicio."
    );
  }

  if (status.missing.includes("lugarServicio")) {
    return t?.eligeLugarServicio ?? "Elige dónde se prestará el servicio.";
  }

  if (status.missing.includes("fechaFin")) {
    return t?.seleccionaFechaFin ?? "Selecciona la fecha de fin.";
  }

  if (status.missing.includes("fechaInicio")) {
    return t?.seleccionaFechaInicio ?? "Selecciona la fecha de inicio.";
  }

  return (
    t?.completaFechasParaVer ??
    "Completa las fechas de tu reserva para ver servicios adicionales disponibles."
  );
}
