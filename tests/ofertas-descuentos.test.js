import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyBestDiscountToBase,
  getBestDiscountPercent,
  getDescuentoDuracionPercent,
  normalizeDescuentosDuracion,
  serializeDescuentosDuracionForDb,
} from "@/app/lib/descuentosDuracion";
import {
  getPrecioConDescuento,
  getPrecioEfectivo,
  isOfertaActiva,
} from "@/app/lib/ofertas";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ofertas", () => {
  it("activa hasta el último día inclusive", () => {
    expect(isOfertaActiva({ oferta_descuento: 20, oferta_valida_hasta: "2026-09-10" })).toBe(true);
    expect(isOfertaActiva({ oferta_descuento: 20, oferta_valida_hasta: "2026-09-09" })).toBe(false);
  });

  it("sin descuento o sin fecha no hay oferta", () => {
    expect(isOfertaActiva({ oferta_valida_hasta: "2026-12-31" })).toBe(false);
    expect(isOfertaActiva({ oferta_descuento: 20 })).toBe(false);
    expect(isOfertaActiva(null)).toBe(false);
  });

  it("calcula el precio con descuento a 2 decimales", () => {
    expect(getPrecioConDescuento(100, 20)).toBe(80);
    expect(getPrecioConDescuento(33.33, 10)).toBe(30);
    expect(getPrecioConDescuento(100, 0)).toBe(100);
  });

  it("precio efectivo solo con oferta activa", () => {
    const activa = { precio: 100, oferta_descuento: 25, oferta_valida_hasta: "2026-09-30" };
    expect(getPrecioEfectivo(activa)).toBe(75);
    expect(getPrecioEfectivo({ ...activa, oferta_valida_hasta: "2026-09-01" })).toBe(100);
  });
});

describe("normalizeDescuentosDuracion", () => {
  it("descarta tramos inválidos y ordena por días", () => {
    expect(
      normalizeDescuentosDuracion([
        { minDias: 7, descuento: 15 },
        { minDias: 0, descuento: 10 },
        { minDias: 3, descuento: 0 },
        { minDias: 3, descuento: 60 },
        { minDias: 3, descuento: 5 },
      ]),
    ).toEqual([
      { minDias: 3, descuento: 5 },
      { minDias: 7, descuento: 15 },
    ]);
  });

  it("entradas vacías o no array dan lista vacía", () => {
    expect(normalizeDescuentosDuracion(null)).toEqual([]);
    expect(normalizeDescuentosDuracion("x")).toEqual([]);
  });
});

describe("descuento por duración", () => {
  const svc = {
    descuentos_duracion: [
      { minDias: 3, descuento: 5 },
      { minDias: 7, descuento: 15 },
    ],
  };

  it("aplica el mejor tramo alcanzado", () => {
    expect(getDescuentoDuracionPercent(svc, 7)).toBe(15);
    expect(getDescuentoDuracionPercent(svc, 5)).toBe(5);
    expect(getDescuentoDuracionPercent(svc, 2)).toBe(0);
  });
});

describe("getBestDiscountPercent", () => {
  const tramo = [{ minDias: 3, descuento: 10 }];

  it("gana la oferta si es mayor", () => {
    expect(
      getBestDiscountPercent(
        {
          descuentos_duracion: tramo,
          oferta_descuento: 20,
          oferta_valida_hasta: "2026-09-30",
        },
        3,
      ),
    ).toEqual({ pct: 20, source: "offer" });
  });

  it("en empate gana la duración", () => {
    expect(
      getBestDiscountPercent(
        {
          descuentos_duracion: tramo,
          oferta_descuento: 10,
          oferta_valida_hasta: "2026-09-30",
        },
        3,
      ),
    ).toEqual({ pct: 10, source: "duration" });
  });

  it("una oferta caducada no cuenta", () => {
    expect(
      getBestDiscountPercent(
        { oferta_descuento: 50, oferta_valida_hasta: "2026-01-01" },
        3,
      ),
    ).toEqual({ pct: 0, source: null });
  });

  it("nunca se acumulan: se elige uno solo", () => {
    const r = applyBestDiscountToBase(
      200,
      {
        descuentos_duracion: [{ minDias: 7, descuento: 15 }],
        oferta_descuento: 10,
        oferta_valida_hasta: "2026-09-30",
      },
      7,
    );
    expect(r).toEqual({ total: 170, pct: 15, source: "duration" });
  });

  it("sin descuento devuelve la base intacta", () => {
    expect(applyBestDiscountToBase(200, {}, 7)).toEqual({
      total: 200,
      pct: 0,
      source: null,
    });
  });
});

describe("serializeDescuentosDuracionForDb", () => {
  it("desactivado guarda null", () => {
    expect(
      serializeDescuentosDuracionForDb({
        descuentos_duracion_activa: false,
        descuentos_duracion: [{ minDias: 3, descuento: 10 }],
      }),
    ).toBeNull();
  });

  it("acota al 50 %, ordena y guarda como máximo 3 tramos", () => {
    const r = serializeDescuentosDuracionForDb({
      descuentos_duracion_activa: true,
      descuentos_duracion: [
        { minDias: 14, descuento: 80 },
        { minDias: 3, descuento: 5 },
        { minDias: 7, descuento: 10 },
        { minDias: 30, descuento: 20 },
      ],
    });
    expect(r).toEqual([
      { minDias: 3, descuento: 5 },
      { minDias: 7, descuento: 10 },
      { minDias: 14, descuento: 50 },
    ]);
  });

  it("sin tramos válidos guarda null", () => {
    expect(
      serializeDescuentosDuracionForDb({
        descuentos_duracion_activa: true,
        descuentos_duracion: [{ minDias: 0, descuento: 10 }],
      }),
    ).toBeNull();
  });
});
