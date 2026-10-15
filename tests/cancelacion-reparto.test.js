import { describe, expect, it } from "vitest";
import {
  CANCEL_CLIENT_PLATFORM_RATE_MAX,
  calcularRepartoCancelacionCliente,
} from "@/app/lib/cancelacion-cliente-reparto";

describe("calcularRepartoCancelacionCliente", () => {
  // Ejemplos documentados en el propio código (precio 91,20 €).
  it("50 % reembolsado", () => {
    expect(calcularRepartoCancelacionCliente(91.2, 50)).toEqual({
      no_reembolsado: 45.6,
      comision_plataforma: 4.1,
      parte_proveedor: 41.5,
      tasa_plataforma: 0.09,
    });
  });

  it("0 % reembolsado: la plataforma se queda el máximo (18 %)", () => {
    expect(calcularRepartoCancelacionCliente(91.2, 0)).toEqual({
      no_reembolsado: 91.2,
      comision_plataforma: 16.42,
      parte_proveedor: 74.78,
      tasa_plataforma: CANCEL_CLIENT_PLATFORM_RATE_MAX,
    });
  });

  it("100 % reembolsado: nadie cobra nada", () => {
    expect(calcularRepartoCancelacionCliente(91.2, 100)).toEqual({
      no_reembolsado: 0,
      comision_plataforma: 0,
      parte_proveedor: 0,
      tasa_plataforma: 0,
    });
  });

  it("acota porcentajes fuera de rango", () => {
    expect(calcularRepartoCancelacionCliente(91.2, 150)).toEqual(
      calcularRepartoCancelacionCliente(91.2, 100),
    );
    expect(calcularRepartoCancelacionCliente(91.2, -10)).toEqual(
      calcularRepartoCancelacionCliente(91.2, 0),
    );
  });

  it("tolera entradas inválidas sin devolver NaN", () => {
    const r = calcularRepartoCancelacionCliente("abc", undefined);
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
  });

  it("plataforma + proveedor suman siempre lo no reembolsado (±1 cént.)", () => {
    for (const precio of [10, 33.33, 91.2, 114, 999.99]) {
      for (const pct of [0, 25, 50, 75, 100]) {
        const r = calcularRepartoCancelacionCliente(precio, pct);
        expect(
          Math.abs(r.comision_plataforma + r.parte_proveedor - r.no_reembolsado),
        ).toBeLessThanOrEqual(0.01);
      }
    }
  });
});
