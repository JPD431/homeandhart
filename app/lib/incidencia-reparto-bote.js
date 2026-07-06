import {
  getBookingPrecioBase,
  getIngresoProveedorFromBooking,
  HOST_COMMISSION_RATE,
  roundMoney,
} from "@/app/lib/ingresos-proveedor";

/** Tolerancia máxima al sumar cliente + proveedor al bote (1 céntimo). */
export const REPARTO_ROUNDING_EPSILON = 0.01;

/** Mínimo de captura parcial en Stripe (EUR, céntimos). */
export const STRIPE_MIN_CAPTURE_CENTS = 50;

/**
 * Bote y comisiones H&H fijas para reparto en incidencia.
 * H&H retiene siempre comisión cliente + comisión proveedor; el bote es lo repartible.
 */
export function calcularBoteRepartoIncidencia(booking) {
  const precioTotal = roundMoney(Number(booking.precio_total) || 0);
  const precioBase = roundMoney(getBookingPrecioBase(booking));
  const creditoAplicado = roundMoney(Number(booking.credito_aplicado) || 0);

  const comisionCliente = roundMoney(Math.max(0, precioTotal - precioBase));
  const proveedorSinComision = booking.proveedor_sin_comision === true;
  const comisionProveedor = proveedorSinComision
    ? 0
    : roundMoney(precioBase * HOST_COMMISSION_RATE);
  const comisionHHTotal = roundMoney(comisionCliente + comisionProveedor);
  const bote = roundMoney(getIngresoProveedorFromBooking(booking));
  const importeTarjeta = roundMoney(Math.max(0, precioTotal - creditoAplicado));

  return {
    precio_total: precioTotal,
    precio_base: precioBase,
    credito_aplicado: creditoAplicado,
    importe_tarjeta: importeTarjeta,
    comision_cliente: comisionCliente,
    comision_proveedor: comisionProveedor,
    comision_hh_total: comisionHHTotal,
    bote,
  };
}

/** Desglose devolución cliente: crédito + tarjeta (uncapture/refund). */
export function desglosarDevolucionCliente(importeCliente, creditoAplicado) {
  const credito = roundMoney(Math.min(importeCliente, creditoAplicado));
  const tarjeta = roundMoney(importeCliente - credito);
  return { credito, tarjeta };
}

/**
 * Céntimos a capturar en Stripe (tarjeta).
 *
 * REDONDEO (documentado):
 * 1. Comisiones/bote: roundMoney (2 decimales, half-up estándar).
 * 2. Split del PI en céntimos enteros sin perder 1c del importe autorizado:
 *    - liberación_tarjeta_cents = round(tarjetaCliente × 100)  → lo que recupera el cliente en tarjeta
 *    - captura_cents = piAmountCents − liberación_tarjeta_cents
 * 3. El PI queda repartido al céntimo; cualquier drift de 1c entre bote teórico y tarjeta
 *    queda en la captura (H&H), nunca en perjuicio del importe acordado al proveedor (transfer
 *    exacto en €) ni del total devuelto al cliente (crédito + tarjeta = importeCliente).
 */
export function calcularCapturaRepartoCents(
  importeTarjeta,
  tarjetaCliente,
  piAmountCents = null,
) {
  const piCents =
    piAmountCents ?? Math.round(roundMoney(importeTarjeta) * 100);
  const liberacionTarjetaCents = Math.round(roundMoney(tarjetaCliente) * 100);
  const uncaptureCents = Math.min(piCents, Math.max(0, liberacionTarjetaCents));
  return Math.max(0, piCents - uncaptureCents);
}

/**
 * Normaliza importes tras redondeo UI: suma debe cuadrar con el bote (±1c).
 * El céntimo de ajuste se asigna al proveedor solo si corrige error de float en UI;
 * en validación estricta la suma ya debe ser exacta.
 */
export function normalizarRepartoImportes(bote, importeCliente, importeProveedor) {
  const b = roundMoney(bote);
  let ic = roundMoney(importeCliente);
  let ip = roundMoney(importeProveedor);
  const diff = roundMoney(b - roundMoney(ic + ip));

  if (Math.abs(diff) > REPARTO_ROUNDING_EPSILON) {
    return null;
  }

  if (diff !== 0) {
    ip = roundMoney(ip + diff);
  }

  return { importe_cliente: ic, importe_proveedor: ip, bote: b };
}

export function validarRepartoImportes(bote, importeCliente, importeProveedor) {
  const normalized = normalizarRepartoImportes(bote, importeCliente, importeProveedor);

  if (!normalized) {
    const ic = roundMoney(importeCliente);
    const ip = roundMoney(importeProveedor);
    const b = roundMoney(bote);
    const suma = roundMoney(ic + ip);

    if (ic < 0 || ip < 0) {
      return { ok: false, error: "Los importes no pueden ser negativos." };
    }

    return {
      ok: false,
      error: `Cliente (${ic.toFixed(2)} €) + proveedor (${ip.toFixed(2)} €) = ${suma.toFixed(2)} €, pero el bote a repartir es ${b.toFixed(2)} €. Deben sumar el bote completo.`,
      suma,
      bote: b,
    };
  }

  if (normalized.importe_cliente < 0 || normalized.importe_proveedor < 0) {
    return { ok: false, error: "Los importes no pueden ser negativos." };
  }

  return {
    ok: true,
    importe_cliente: normalized.importe_cliente,
    importe_proveedor: normalized.importe_proveedor,
    bote: normalized.bote,
  };
}

/** ¿Reparto degenera en reembolso total al cliente (captura 0 en tarjeta)? */
export function esReembolsoTotalPorReparto(boteInfo, importeCliente, importeProveedor) {
  if (roundMoney(importeProveedor) > 0) return false;
  const { tarjeta } = desglosarDevolucionCliente(
    importeCliente,
    boteInfo.credito_aplicado,
  );
  const captureCents = calcularCapturaRepartoCents(
    boteInfo.importe_tarjeta,
    tarjeta,
    null,
  );
  return captureCents <= 0;
}

export function validarCapturaRepartoStripe(
  amountToCaptureCents,
  importeProveedor,
  piAmountCents,
) {
  if (amountToCaptureCents > piAmountCents) {
    return {
      ok: false,
      error: `Captura calculada (${amountToCaptureCents} c.) supera el PI (${piAmountCents} c.).`,
    };
  }

  if (amountToCaptureCents <= 0) {
    if (roundMoney(importeProveedor) > 0) {
      return {
        ok: false,
        error:
          "Captura 0 € en tarjeta pero hay importe al proveedor: reparto inconsistente. Usa otro flujo.",
      };
    }
    return { ok: true, action: "cancel_pi" };
  }

  if (
    amountToCaptureCents < STRIPE_MIN_CAPTURE_CENTS &&
    roundMoney(importeProveedor) > 0
  ) {
    return {
      ok: false,
      error: `La captura (${(amountToCaptureCents / 100).toFixed(2)} €) es inferior al mínimo de Stripe (0,50 €) con pago al proveedor. Ajusta el reparto.`,
    };
  }

  return { ok: true, action: "capture" };
}
