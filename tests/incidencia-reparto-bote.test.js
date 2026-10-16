import { describe, expect, it } from "vitest";
import {
  calcularBoteRepartoIncidencia,
  calcularCapturaRepartoCents,
  desglosarDevolucionCliente,
  esReembolsoTotalPorReparto,
  normalizarRepartoImportes,
  validarCapturaRepartoStripe,
  validarRepartoImportes,
} from "@/app/lib/incidencia-reparto-bote";

describe("calcularBoteRepartoIncidencia", () => {
  it("separa comisiones de H&H y bote repartible", () => {
    expect(
      calcularBoteRepartoIncidencia({ precio_total: 114, precio_base: 100 }),
    ).toEqual({
      precio_total: 114,
      precio_base: 100,
      credito_aplicado: 0,
      importe_tarjeta: 114,
      comision_cliente: 14,
      comision_proveedor: 4,
      comision_hh_total: 18,
      bote: 96,
    });
  });

  it("proveedor sin comisión: el bote es toda la base", () => {
    const r = calcularBoteRepartoIncidencia({
      precio_total: 114,
      precio_base: 100,
      proveedor_sin_comision: true,
    });
    expect(r.comision_proveedor).toBe(0);
    expect(r.bote).toBe(100);
  });

  it("el crédito aplicado reduce lo cobrado en tarjeta", () => {
    const r = calcularBoteRepartoIncidencia({
      precio_total: 114,
      precio_base: 100,
      credito_aplicado: 20,
    });
    expect(r.importe_tarjeta).toBe(94);
  });
});

describe("desglosarDevolucionCliente", () => {
  it("devuelve primero el crédito y el resto a tarjeta", () => {
    expect(desglosarDevolucionCliente(50, 20)).toEqual({ credito: 20, tarjeta: 30 });
  });

  it("si devuelve menos que el crédito, todo va a crédito", () => {
    expect(desglosarDevolucionCliente(10, 20)).toEqual({ credito: 10, tarjeta: 0 });
  });
});

describe("calcularCapturaRepartoCents", () => {
  it("captura lo que no se libera al cliente", () => {
    expect(calcularCapturaRepartoCents(114, 30, 11400)).toBe(8400);
  });

  it("no captura nada si se libera todo", () => {
    expect(calcularCapturaRepartoCents(114, 114, 11400)).toBe(0);
    expect(calcularCapturaRepartoCents(114, 500, 11400)).toBe(0);
  });

  it("importes negativos no aumentan la captura por encima del PI", () => {
    expect(calcularCapturaRepartoCents(114, -5, 11400)).toBe(11400);
  });
});

describe("normalizarRepartoImportes / validarRepartoImportes", () => {
  it("suma exacta", () => {
    expect(normalizarRepartoImportes(96, 40, 56)).toEqual({
      importe_cliente: 40,
      importe_proveedor: 56,
      bote: 96,
    });
  });

  it("corrige 1 céntimo de diferencia sobre el proveedor", () => {
    expect(normalizarRepartoImportes(96, 40, 55.99)?.importe_proveedor).toBe(56);
  });

  it("rechaza si no cuadra", () => {
    expect(normalizarRepartoImportes(96, 40, 55)).toBeNull();
    const v = validarRepartoImportes(96, 40, 50);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/bote/);
  });

  it("rechaza importes negativos aunque sumen el bote", () => {
    const v = validarRepartoImportes(96, -10, 106);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/negativos/);
  });

  it("acepta un reparto válido", () => {
    expect(validarRepartoImportes(96, 40, 56)).toMatchObject({ ok: true });
  });
});

describe("esReembolsoTotalPorReparto", () => {
  const info = { credito_aplicado: 0, importe_tarjeta: 114 };

  it("devolver todo lo pagado sin pagar al proveedor es reembolso total", () => {
    expect(esReembolsoTotalPorReparto(info, 114, 0)).toBe(true);
  });

  it("si H&H retiene comisiones no es total", () => {
    expect(esReembolsoTotalPorReparto(info, 96, 0)).toBe(false);
  });

  it("si hay pago al proveedor nunca es total", () => {
    expect(esReembolsoTotalPorReparto(info, 0, 96)).toBe(false);
  });
});

describe("validarCapturaRepartoStripe", () => {
  it("captura normal", () => {
    expect(validarCapturaRepartoStripe(1800, 56, 11400)).toEqual({
      ok: true,
      action: "capture",
    });
  });

  it("captura 0 sin proveedor cancela el PI", () => {
    expect(validarCapturaRepartoStripe(0, 0, 11400)).toEqual({
      ok: true,
      action: "cancel_pi",
    });
  });

  it("captura 0 con pago a proveedor es inconsistente", () => {
    expect(validarCapturaRepartoStripe(0, 50, 11400).ok).toBe(false);
  });

  it("por debajo del mínimo de Stripe (0,50 €) con proveedor es error", () => {
    expect(validarCapturaRepartoStripe(20, 5, 11400).ok).toBe(false);
    expect(validarCapturaRepartoStripe(20, 0, 11400).ok).toBe(true);
  });

  it("no se puede capturar más que el PI", () => {
    expect(validarCapturaRepartoStripe(12000, 0, 11400).ok).toBe(false);
  });
});
