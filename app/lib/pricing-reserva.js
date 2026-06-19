import { applyBestDiscountToBase } from "@/app/lib/descuentosDuracion";

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

export function getEstanciaUnit(vertical, count) {
  const n = Number(count);
  if (vertical === "alojamiento") return n === 1 ? "noche" : "noches";
  if (vertical === "ninos") return n === 1 ? "hora" : "horas";
  return n === 1 ? "día" : "días";
}

export function getServiceDuration(svc, { fechaInicio, fechaFin, duracionHoras, mainVertical }) {
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

export function calculateServiceBasePrice(
  svc,
  { fechaInicio, fechaFin, duracionHoras, mainVertical },
  unitPriceOverride = null,
) {
  const useOverride =
    unitPriceOverride != null && Number(unitPriceOverride) > 0;
  const unitPrice = useOverride
    ? Number(unitPriceOverride)
    : Number(svc.precio) || 0;
  if (!unitPrice) return { base: 0, detail: "", ready: false, discountPct: 0, discountSource: null };

  const v = svc.vertical;
  const dateContext = { fechaInicio, fechaFin, duracionHoras, mainVertical };

  function finalizeBase(subtotal, detail, ready, duration) {
    if (useOverride) {
      return {
        base: subtotal,
        detail,
        ready,
        discountPct: 0,
        discountSource: null,
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
    };
  }

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
      };
    }
    const subtotal = unitPrice * hours;
    const duration = getServiceDuration(svc, dateContext);
    return finalizeBase(
      subtotal,
      `${hours} hora${hours > 1 ? "s" : ""}`,
      true,
      duration,
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
    };
  }
  const unit = v === "alojamiento" ? "noche" : "día";
  const subtotal = unitPrice * days;
  const duration = getServiceDuration(svc, dateContext);
  return finalizeBase(
    subtotal,
    `${days} ${unit}${days > 1 ? "s" : ""}`,
    true,
    duration,
  );
}
