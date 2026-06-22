import { roundMoney } from "@/app/lib/ingresos-proveedor";

/** Comisión plataforma máxima sobre lo no reembolsado (reserva sin reembolso al cliente). */
export const CANCEL_CLIENT_PLATFORM_RATE_MAX = 0.18;

/**
 * Reparto de lo no reembolsado al cliente entre plataforma y proveedor.
 *
 * Ejemplos (precioTotal = 91,20 €):
 * - pct = 50 → no_reembolsado 45,60; comision_plataforma 4,10; parte_proveedor 41,50
 * - pct = 0  → no_reembolsado 91,20; comision_plataforma 16,42; parte_proveedor 74,78
 * - pct = 100 → no_reembolsado 0; comision_plataforma 0; parte_proveedor 0
 *
 * @param {number|string} precioTotal Precio de la reserva (con comisión cliente, precio_total).
 * @param {number} pct Porcentaje reembolsado al cliente (0–100).
 */
export function calcularRepartoCancelacionCliente(precioTotal, pct) {
  const precio = Number(precioTotal) || 0;
  const refundPct = Math.min(100, Math.max(0, Number(pct) || 0));
  const fraccionNoReembolsada = 1 - refundPct / 100;

  const no_reembolsado = roundMoney(precio * fraccionNoReembolsada);
  const tasa_plataforma = roundMoney(
    CANCEL_CLIENT_PLATFORM_RATE_MAX * fraccionNoReembolsada,
  );
  const comision_plataforma = roundMoney(no_reembolsado * tasa_plataforma);
  const parte_proveedor = roundMoney(no_reembolsado - comision_plataforma);

  return {
    no_reembolsado,
    comision_plataforma,
    parte_proveedor,
    tasa_plataforma,
  };
}
