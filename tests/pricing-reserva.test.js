import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyClientPrice,
  calculateServiceBasePrice,
  daysBetween,
  getNochesEstancia,
} from "@/app/lib/pricing-reserva";

describe("daysBetween", () => {
  it("cuenta noches entre dos fechas", () => {
    expect(daysBetween("2026-09-10", "2026-09-13")).toBe(3);
  });

  it("mismo día cuenta como 1", () => {
    expect(daysBetween("2026-09-10", "2026-09-10")).toBe(1);
  });

  it("fin anterior al inicio o fechas vacías dan 0", () => {
    expect(daysBetween("2026-09-13", "2026-09-10")).toBe(0);
    expect(daysBetween(null, "2026-09-10")).toBe(0);
    expect(daysBetween("2026-09-10", "")).toBe(0);
  });
});

// El cliente (navegador) calcula en hora local y el servidor en UTC: el
// resultado debe ser el mismo aunque la estancia cruce un cambio de hora.
describe("daysBetween con cambio de hora (Europe/Madrid)", () => {
  let tzOriginal;
  beforeAll(() => {
    tzOriginal = process.env.TZ;
    process.env.TZ = "Europe/Madrid";
  });
  afterAll(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });

  it("fin del horario de verano (25/10/2026): 24→26 son 2 noches", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-20", "2026-10-27")).toBe(7);
  });

  it("inicio del horario de verano (29/03/2026): 28→30 son 2 noches", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("getNochesEstancia", () => {
  it("lista cada noche cobrable", () => {
    expect(getNochesEstancia("2026-09-10", "2026-09-13", "alojamiento")).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("sin fecha de fin es una noche; sin inicio, ninguna", () => {
    expect(getNochesEstancia("2026-09-10", null)).toEqual(["2026-09-10"]);
    expect(getNochesEstancia(null, null)).toEqual([]);
  });
});

describe("applyClientPrice", () => {
  it("suma el 14 % de comisión de cliente", () => {
    expect(applyClientPrice(100)).toBe(114);
    expect(applyClientPrice(0)).toBe(0);
  });
});

describe("calculateServiceBasePrice · alojamiento", () => {
  const svc = { vertical: "alojamiento", precio: 50 };
  const ctx = {
    fechaInicio: "2026-09-10",
    fechaFin: "2026-09-13",
    mainVertical: "alojamiento",
  };

  it("precio por noche × noches", () => {
    expect(calculateServiceBasePrice(svc, ctx)).toMatchObject({
      base: 150,
      ready: true,
      detail: "3 noches",
      discountPct: 0,
    });
  });

  it("tarifas por fecha sustituyen el precio de esa noche", () => {
    const r = calculateServiceBasePrice(svc, ctx, null, { "2026-09-11": 80 });
    expect(r.base).toBe(180);
  });

  it("descuento por duración (10 % a partir de 3 noches)", () => {
    const conDescuento = {
      ...svc,
      descuentos_duracion: [{ minDias: 3, descuento: 10 }],
    };
    expect(calculateServiceBasePrice(conDescuento, ctx)).toMatchObject({
      base: 135,
      discountPct: 10,
      discountSource: "duration",
    });
  });

  it("el descuento no aplica si no se llega a la duración mínima", () => {
    const conDescuento = {
      ...svc,
      descuentos_duracion: [{ minDias: 7, descuento: 10 }],
    };
    expect(calculateServiceBasePrice(conDescuento, ctx).base).toBe(150);
  });

  it("un precio forzado ignora descuentos", () => {
    const conDescuento = {
      ...svc,
      descuentos_duracion: [{ minDias: 3, descuento: 10 }],
    };
    expect(calculateServiceBasePrice(conDescuento, ctx, 60)).toMatchObject({
      base: 180,
      discountPct: 0,
    });
  });

  it("sin fechas no está listo", () => {
    expect(calculateServiceBasePrice(svc, {}).ready).toBe(false);
  });

  it("sin precio no está listo", () => {
    expect(
      calculateServiceBasePrice({ vertical: "alojamiento", precio: 0 }, ctx),
    ).toMatchObject({ base: 0, ready: false });
  });
});

describe("calculateServiceBasePrice · niños", () => {
  const svc = { vertical: "ninos", precio: 12 };

  it("precio por hora × horas", () => {
    expect(
      calculateServiceBasePrice(svc, {
        fechaInicio: "2026-09-10",
        duracionHoras: 4,
        mainVertical: "ninos",
      }),
    ).toMatchObject({ base: 48, ready: true, detail: "4 horas" });
  });

  it("sin duración pide las horas", () => {
    expect(
      calculateServiceBasePrice(svc, {
        fechaInicio: "2026-09-10",
        mainVertical: "ninos",
      }),
    ).toMatchObject({ base: 0, ready: false });
  });
});

describe("calculateServiceBasePrice · modalidades de cobro", () => {
  const svc = {
    vertical: "mascotas",
    modalidades: [{ modalidad: "dia", precio: 20 }],
  };

  it("cobra según la modalidad definida", () => {
    expect(
      calculateServiceBasePrice(svc, {
        fechaInicio: "2026-09-10",
        fechaFin: "2026-09-13",
        mainVertical: "mascotas",
      }),
    ).toMatchObject({ base: 60, ready: true, modalidadCobro: "dia" });
  });

  it("modalidad solicitada que no existe da error si es obligatoria", () => {
    const multi = {
      ...svc,
      modalidades: [
        { modalidad: "dia", precio: 20 },
        { modalidad: "hora", precio: 8 },
      ],
    };
    const r = calculateServiceBasePrice(multi, {
      fechaInicio: "2026-09-10",
      fechaFin: "2026-09-11",
      mainVertical: "mascotas",
      modalidadCobro: "medio_dia",
      requireModalidad: true,
    });
    expect(r.ready).toBe(false);
    expect(r.base).toBe(0);
  });
});
