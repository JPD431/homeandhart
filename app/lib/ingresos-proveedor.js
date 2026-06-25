import { PLATFORM_MULTIPLIER } from "@/app/lib/pricing-reserva";

/** Comisión de anfitrión (4 % sobre la base del proveedor). */
export const HOST_COMMISSION_RATE = 0.04;

/** Factor neto tras comisión de anfitrión: base × 0.96. */
export const HOST_PAYOUT_FACTOR = 1 - HOST_COMMISSION_RATE;

export function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

/** Base del proveedor a partir del precio cobrado al cliente (precio_total). */
export function getPrecioBaseProveedor(precioTotal) {
  return (Number(precioTotal) || 0) / PLATFORM_MULTIPLIER;
}

/**
 * Base canónica de una reserva (precio_base si existe; inferencia para filas antiguas).
 * @param {{ precio_base?: number|null, precio_total?: number|string, cliente_sin_comision?: boolean }} booking
 */
export function getBookingPrecioBase(booking) {
  if (booking?.precio_base != null && booking.precio_base !== "") {
    return roundMoney(Number(booking.precio_base));
  }

  const total = Number(booking?.precio_total) || 0;
  if (booking?.cliente_sin_comision === true) {
    return roundMoney(total);
  }

  return roundMoney(total / PLATFORM_MULTIPLIER);
}

/**
 * Ingreso neto del proveedor a partir de un booking.
 * @param {{ precio_base?: number|null, precio_total?: number|string, cliente_sin_comision?: boolean, proveedor_sin_comision?: boolean }} booking
 * @param {{ sinComisionProveedor?: boolean }} options
 */
export function getIngresoProveedorFromBooking(booking, { sinComisionProveedor } = {}) {
  const base = getBookingPrecioBase(booking);
  const sinComision =
    sinComisionProveedor !== undefined
      ? sinComisionProveedor
      : booking?.proveedor_sin_comision === true;

  return roundMoney(getIngresoProveedorDesdeBase(base, { sinComision }));
}

/**
 * Ingreso neto del proveedor para una reserva (precio_total de un booking).
 * @param {number|string} precioTotal Precio pagado por el cliente (con comisión cliente).
 * @param {{ sinComision?: boolean }} options true = reserva sin comisión del proveedor (100 % base).
 */
export function getIngresoProveedor(precioTotal, { sinComision = false } = {}) {
  const base = getPrecioBaseProveedor(precioTotal);
  if (sinComision) return roundMoney(base);
  return roundMoney(base * HOST_PAYOUT_FACTOR);
}

/**
 * Bruto a transferir a partir de una base ya acumulada (p. ej. suma de varios bookings).
 * Sin redondeo intermedio: mismo comportamiento que capture-payment antes de descontar deuda.
 */
export function getIngresoProveedorDesdeBase(base, { sinComision = false } = {}) {
  const b = Number(base) || 0;
  if (sinComision) return b;
  return b * HOST_PAYOUT_FACTOR;
}
