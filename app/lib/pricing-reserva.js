import { applyBestDiscountToBase } from "@/app/lib/descuentosDuracion";
import { getHuespedesSuplementoPorNoche } from "@/app/lib/huespedes-precio";
import {
  MODALIDAD_COBRO_VALUES,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

// getModalidadCobroPriceUnit unused after detail fix — keep import minimal

export const PLATFORM_MULTIPLIER = 1.14;
export const COMMISSION_RATE = 0.14;

export function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const diff = b.getTime() - a.getTime();
  if (diff < 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function addDaysToDateStr(dateStr, offsetDays) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fechas cobrables (YYYY-MM-DD), mismo conteo que daysBetween. */
export function getNochesEstancia(fechaInicio, fechaFin, _vertical) {
  if (!fechaInicio) return [];
  const end = fechaFin || fechaInicio;
  const count = daysBetween(fechaInicio, end);
  if (count === 0) return [];

  const fechas = [];
  for (let i = 0; i < count; i++) {
    fechas.push(addDaysToDateStr(fechaInicio, i));
  }
  return fechas;
}

function hasTarifasPorFecha(tarifasPorFecha) {
  return (
    tarifasPorFecha != null &&
    typeof tarifasPorFecha === "object" &&
    Object.keys(tarifasPorFecha).length > 0
  );
}

function precioParaFecha(fecha, unitPrice, tarifasPorFecha) {
  if (
    tarifasPorFecha &&
    Object.prototype.hasOwnProperty.call(tarifasPorFecha, fecha)
  ) {
    const tarifa = Number(tarifasPorFecha[fecha]);
    if (Number.isFinite(tarifa) && tarifa > 0) return tarifa;
  }
  return unitPrice;
}

function subtotalPorEstancia(
  unitPrice,
  fechas,
  tarifasPorFecha,
  suplementoNoche = 0,
) {
  const extra = Number(suplementoNoche) || 0;
  if (!hasTarifasPorFecha(tarifasPorFecha)) {
    return (unitPrice + extra) * fechas.length;
  }
  return fechas.reduce(
    (sum, fecha) =>
      sum + precioParaFecha(fecha, unitPrice, tarifasPorFecha) + extra,
    0,
  );
}

export function getEstanciaUnit(vertical, count, modalidadCobro = null) {
  const n = Number(count);
  if (modalidadCobro === "hora") return n === 1 ? "hora" : "horas";
  if (modalidadCobro === "medio_dia") {
    return n === 1 ? "medio día" : "medios días";
  }
  if (modalidadCobro === "dia") return n === 1 ? "día" : "días";
  if (vertical === "alojamiento") return n === 1 ? "noche" : "noches";
  if (vertical === "ninos") return n === 1 ? "hora" : "horas";
  return n === 1 ? "día" : "días";
}

/** Filas activas de service_modalidades en el objeto servicio (si se cargaron). */
export function getServiceModalidadesRows(svc) {
  if (!svc || !supportsModalidadCobro(svc.vertical)) return [];
  return Array.isArray(svc.modalidades) ? svc.modalidades : [];
}

/**
 * Suplemento por unidad desde la fila de modalidad.
 * niños_extra = max(0, num - huespedes_incluidos); si no hay incluidos → 0.
 */
export function getModalidadSuplementoPorUnidad(svc, modalidadRow, numHuespedes) {
  const supl = Number(modalidadRow?.suplemento_extra) || 0;
  if (supl <= 0) return 0;

  const incluidosRaw = Number(svc?.huespedes_incluidos);
  if (!Number.isFinite(incluidosRaw) || incluidosRaw <= 0) return 0;
  const incluidos = Math.floor(incluidosRaw);

  let n;
  if (numHuespedes == null || numHuespedes === "") {
    n = incluidos;
  } else {
    n = Number(numHuespedes);
    if (!Number.isFinite(n)) n = incluidos;
    else n = Math.floor(n);
  }

  return Math.max(0, n - incluidos) * supl;
}

/**
 * Resuelve cómo cobrar este servicio.
 * @returns {{ kind: 'legacy' } | { kind: 'modalidad', modalidad: string, row: object } | { kind: 'error', error: string }}
 */
export function resolveBillingForService(svc, modalidadCobroRequested, {
  requireModalidad = false,
} = {}) {
  if (!svc) return { kind: "error", error: "Servicio no encontrado" };
  if (svc.vertical === "alojamiento") return { kind: "legacy" };

  const rows = getServiceModalidadesRows(svc);
  if (rows.length === 0) return { kind: "legacy" };

  const requested =
    typeof modalidadCobroRequested === "string" &&
    MODALIDAD_COBRO_VALUES.includes(modalidadCobroRequested)
      ? modalidadCobroRequested
      : null;

  if (requested) {
    const row = rows.find((r) => r.modalidad === requested);
    if (row) return { kind: "modalidad", modalidad: requested, row };
    if (requireModalidad) {
      return {
        kind: "error",
        error: "La modalidad elegida no está disponible para este servicio",
      };
    }
  }

  if (rows.length === 1) {
    return {
      kind: "modalidad",
      modalidad: rows[0].modalidad,
      row: rows[0],
    };
  }

  if (requireModalidad) {
    return {
      kind: "error",
      error: "Elige cómo quieres contratar este servicio",
    };
  }

  // Complementario / sin preferencia: no forzar; legacy de vertical
  return { kind: "legacy" };
}

export function billingNeedsHora(billing) {
  if (!billing || billing.kind !== "modalidad") return null;
  return billing.modalidad === "hora" || billing.modalidad === "medio_dia";
}

export function billingNeedsDuracionHoras(billing) {
  return billing?.kind === "modalidad" && billing.modalidad === "hora";
}

export function billingNeedsFechaFin(billing, vertical) {
  if (billing?.kind === "modalidad") {
    return billing.modalidad === "dia" || billing.modalidad === "medio_dia";
  }
  return vertical === "alojamiento" || vertical === "mascotas";
}

export function getServiceDuration(
  svc,
  { fechaInicio, fechaFin, duracionHoras, mainVertical, modalidadCobro } = {},
) {
  const billing = resolveBillingForService(svc, modalidadCobro);
  if (billing.kind === "modalidad" && billing.modalidad === "hora") {
    return Number(duracionHoras) || 0;
  }
  if (billing.kind === "modalidad") {
    return daysBetween(fechaInicio, fechaFin || fechaInicio);
  }
  if (svc.vertical === "ninos") {
    let hours = Number(duracionHoras) || 0;
    if (!hours && mainVertical !== "ninos") {
      const days = daysBetween(fechaInicio, fechaFin || fechaInicio);
      hours = days > 0 ? days : 0;
    }
    return hours;
  }
  return daysBetween(fechaInicio, fechaFin || fechaInicio);
}

export function applyClientPrice(baseSubtotal) {
  if (!baseSubtotal) return 0;
  return Math.round(baseSubtotal * PLATFORM_MULTIPLIER * 100) / 100;
}

/**
 * Precio base del servicio (sin comisión cliente 14%).
 *
 * Alojamiento: sin cambios (noches + tarifas + suplemento legacy).
 * Niñera/mascotas sin filas service_modalidades: idéntico al histórico.
 * Con modalidades: cobra según modalidad elegida + suplemento_extra de esa fila.
 *
 * @param {object} ctx — { fechaInicio, fechaFin, duracionHoras, mainVertical, numHuespedes?, modalidadCobro?, requireModalidad? }
 */
export function calculateServiceBasePrice(
  svc,
  {
    fechaInicio,
    fechaFin,
    duracionHoras,
    mainVertical,
    numHuespedes,
    modalidadCobro,
    requireModalidad = false,
  } = {},
  unitPriceOverride = null,
  tarifasPorFecha = null,
) {
  const useOverride =
    unitPriceOverride != null && Number(unitPriceOverride) > 0;

  const billing = resolveBillingForService(svc, modalidadCobro, {
    requireModalidad,
  });
  if (billing.kind === "error") {
    return {
      base: 0,
      detail: billing.error,
      ready: false,
      discountPct: 0,
      discountSource: null,
      modalidadCobro: null,
    };
  }

  const dateContext = {
    fechaInicio,
    fechaFin,
    duracionHoras,
    mainVertical,
    modalidadCobro:
      billing.kind === "modalidad" ? billing.modalidad : modalidadCobro,
  };

  function finalizeBase(subtotal, detail, ready, duration, modalidadUsed) {
    if (useOverride) {
      return {
        base: subtotal,
        detail,
        ready,
        discountPct: 0,
        discountSource: null,
        modalidadCobro: modalidadUsed,
      };
    }
    const { total, pct, source } = applyBestDiscountToBase(
      subtotal,
      svc,
      duration,
    );
    return {
      base: total,
      detail,
      ready,
      discountPct: pct,
      discountSource: source,
      modalidadCobro: modalidadUsed,
    };
  }

  // —— Modalidad explícita (filas en service_modalidades) ——
  if (billing.kind === "modalidad") {
    const row = billing.row;
    const modalidad = billing.modalidad;
    const unitPrice = useOverride
      ? Number(unitPriceOverride)
      : Number(row.precio) || 0;
    if (!unitPrice) {
      return {
        base: 0,
        detail: "Precio de modalidad no válido",
        ready: false,
        discountPct: 0,
        discountSource: null,
        modalidadCobro: modalidad,
      };
    }

    const suplemento = getModalidadSuplementoPorUnidad(
      svc,
      row,
      numHuespedes,
    );

    if (modalidad === "hora") {
      let hours = Number(duracionHoras) || 0;
      if (!hours && mainVertical !== svc.vertical) {
        const days = daysBetween(fechaInicio, fechaFin || fechaInicio);
        hours = days > 0 ? days : 0;
      }
      if (!hours) {
        return {
          base: 0,
          detail: "Introduce la duración en horas",
          ready: false,
          discountPct: 0,
          discountSource: null,
          modalidadCobro: modalidad,
        };
      }
      if (!fechaInicio) {
        return {
          base: 0,
          detail: "Introduce la fecha",
          ready: false,
          discountPct: 0,
          discountSource: null,
          modalidadCobro: modalidad,
        };
      }
      const unitForDay = useOverride
        ? unitPrice
        : precioParaFecha(fechaInicio, unitPrice, tarifasPorFecha);
      const subtotal = (unitForDay + suplemento) * hours;
      return finalizeBase(
        subtotal,
        `${hours} hora${hours > 1 ? "s" : ""}`,
        true,
        hours,
        modalidad,
      );
    }

    // dia | medio_dia
    const start = fechaInicio;
    const end = fechaFin || fechaInicio;
    const days = daysBetween(start, end);
    if (!start || days === 0) {
      return {
        base: 0,
        detail: "Introduce las fechas",
        ready: false,
        discountPct: 0,
        discountSource: null,
        modalidadCobro: modalidad,
      };
    }
    const fechasEstancia = getNochesEstancia(start, end, svc.vertical);
    const subtotal = useOverride
      ? (unitPrice + suplemento) * days
      : subtotalPorEstancia(
          unitPrice,
          fechasEstancia,
          tarifasPorFecha,
          suplemento,
        );
    const unitLabel = getEstanciaUnit(svc.vertical, days, modalidad);
    return finalizeBase(subtotal, `${days} ${unitLabel}`, true, days, modalidad);
  }

  // —— Legacy (sin filas / alojamiento) ——
  const unitPrice = useOverride
    ? Number(unitPriceOverride)
    : Number(svc.precio) || 0;
  if (!unitPrice) {
    return {
      base: 0,
      detail: "",
      ready: false,
      discountPct: 0,
      discountSource: null,
      modalidadCobro: null,
    };
  }

  const v = svc.vertical;
  const suplementoPeriodo = getHuespedesSuplementoPorNoche(svc, numHuespedes);

  if (v === "ninos") {
    let hours = Number(duracionHoras) || 0;
    if (!hours && mainVertical !== "ninos") {
      const days = daysBetween(fechaInicio, fechaFin || fechaInicio);
      hours = days > 0 ? days : 0;
    }
    if (!hours) {
      return {
        base: 0,
        detail: "Introduce la duración en horas",
        ready: false,
        discountPct: 0,
        discountSource: null,
        modalidadCobro: null,
      };
    }
    const subtotal = (unitPrice + suplementoPeriodo) * hours;
    const duration = getServiceDuration(svc, dateContext);
    return finalizeBase(
      subtotal,
      `${hours} hora${hours > 1 ? "s" : ""}`,
      true,
      duration,
      null,
    );
  }

  const start = fechaInicio;
  const end = fechaFin || fechaInicio;
  const days = daysBetween(start, end);
  if (!start || days === 0) {
    return {
      base: 0,
      detail: "Introduce fechas de inicio y fin",
      ready: false,
      discountPct: 0,
      discountSource: null,
      modalidadCobro: null,
    };
  }
  const unit = v === "alojamiento" ? "noche" : "día";
  const fechasEstancia = getNochesEstancia(start, end, v);
  const subtotal = useOverride
    ? (unitPrice + suplementoPeriodo) * days
    : subtotalPorEstancia(
        unitPrice,
        fechasEstancia,
        tarifasPorFecha,
        suplementoPeriodo,
      );
  const duration = getServiceDuration(svc, dateContext);
  return finalizeBase(
    subtotal,
    `${days} ${unit}${days > 1 ? "s" : ""}`,
    true,
    duration,
    null,
  );
}
