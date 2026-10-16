import { describe, expect, it } from "vitest";
import {
  emptyModalidadesCobroForm,
  formatModalidadesCobroAnuncio,
  getSyncedServicesPrecio,
  legacyModalidadForVertical,
  parseModalidadesCobroFromRows,
  serializeModalidadesCobroRows,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

function formWith(overrides) {
  const form = emptyModalidadesCobroForm();
  for (const [key, value] of Object.entries(overrides)) {
    form[key] = { ...form[key], ...value };
  }
  return { modalidades_cobro: form };
}

describe("verticales con modalidad", () => {
  it("solo niños y mascotas, cada una con su modalidad histórica", () => {
    expect(supportsModalidadCobro("ninos")).toBe(true);
    expect(supportsModalidadCobro("mascotas")).toBe(true);
    expect(supportsModalidadCobro("alojamiento")).toBe(false);
    expect(legacyModalidadForVertical("ninos")).toBe("hora");
    expect(legacyModalidadForVertical("mascotas")).toBe("dia");
    expect(legacyModalidadForVertical("alojamiento")).toBeNull();
  });
});

describe("serializeModalidadesCobroRows", () => {
  it("exige al menos una modalidad activa", () => {
    const r = serializeModalidadesCobroRows({}, "ninos");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/al menos una modalidad/);
  });

  it("por hora no guarda horas por unidad", () => {
    const r = serializeModalidadesCobroRows(
      formWith({ hora: { activa: true, precio: "10" } }),
      "ninos",
    );
    expect(r).toEqual({
      ok: true,
      rows: [{ modalidad: "hora", precio: 10, horas_unidad: null, suplemento_extra: null }],
    });
  });

  it("por día guarda horas y suplemento", () => {
    const r = serializeModalidadesCobroRows(
      formWith({
        dia: { activa: true, precio: "20", horas_unidad: "8", suplemento_extra: "3" },
      }),
      "mascotas",
    );
    expect(r).toEqual({
      ok: true,
      rows: [{ modalidad: "dia", precio: 20, horas_unidad: 8, suplemento_extra: 3 }],
    });
  });

  it("suplemento 0 se guarda como null", () => {
    const r = serializeModalidadesCobroRows(
      formWith({ hora: { activa: true, precio: "10", suplemento_extra: "0" } }),
      "ninos",
    );
    expect(r.rows[0].suplemento_extra).toBeNull();
  });

  it("rechaza precio 0, horas fuera de rango y suplemento negativo", () => {
    const precio = serializeModalidadesCobroRows(
      formWith({ dia: { activa: true, precio: "0", horas_unidad: "8" } }),
      "mascotas",
    );
    expect(precio.ok).toBe(false);
    expect(precio.error).toMatch(/Por día completo/);

    const horas = serializeModalidadesCobroRows(
      formWith({ dia: { activa: true, precio: "20", horas_unidad: "25" } }),
      "mascotas",
    );
    expect(horas).toEqual({ ok: false, error: "Las horas no pueden superar 24." });

    const supl = serializeModalidadesCobroRows(
      formWith({ hora: { activa: true, precio: "10", suplemento_extra: "-2" } }),
      "ninos",
    );
    expect(supl.ok).toBe(false);
  });

  it("alojamiento no tiene modalidades", () => {
    expect(serializeModalidadesCobroRows({}, "alojamiento")).toEqual({
      ok: true,
      rows: [],
    });
  });
});

describe("parseModalidadesCobroFromRows", () => {
  it("sin filas siembra la modalidad histórica con el precio actual", () => {
    const { modalidades_cobro } = parseModalidadesCobroFromRows("ninos", [], {
      precio: 12,
    });
    expect(modalidades_cobro.hora).toMatchObject({ activa: true, precio: "12" });
    expect(modalidades_cobro.dia.activa).toBe(false);
  });

  it("con filas activa solo las existentes", () => {
    const { modalidades_cobro } = parseModalidadesCobroFromRows("mascotas", [
      { modalidad: "dia", precio: 20, horas_unidad: 8 },
    ]);
    expect(modalidades_cobro.dia).toMatchObject({ activa: true, precio: "20" });
    expect(modalidades_cobro.hora.activa).toBe(false);
  });
});

describe("getSyncedServicesPrecio", () => {
  it("usa el precio de la modalidad histórica si está activa", () => {
    expect(
      getSyncedServicesPrecio(
        { ...formWith({ hora: { activa: true, precio: "12" } }), precio: 99 },
        "ninos",
      ),
    ).toBe(12);
  });

  it("si no, el precio general; sin precio válido, null", () => {
    expect(getSyncedServicesPrecio({ precio: 30 }, "ninos")).toBe(30);
    expect(getSyncedServicesPrecio({ precio: 0 }, "alojamiento")).toBeNull();
  });
});

describe("formatModalidadesCobroAnuncio", () => {
  it("lista las modalidades con precio", () => {
    expect(
      formatModalidadesCobroAnuncio({ vertical: "ninos" }, [
        { modalidad: "dia", precio: 55.5 },
        { modalidad: "hora", precio: 10 },
      ]),
    ).toBe("Por hora 10€ · Por día 55.5€");
  });

  it("sin filas usa el precio histórico del vertical", () => {
    expect(formatModalidadesCobroAnuncio({ vertical: "mascotas", precio: 20 }, null)).toBe(
      "Por día 20€",
    );
    expect(formatModalidadesCobroAnuncio({ vertical: "ninos", precio: 12 }, null)).toBe(
      "Por hora 12€",
    );
  });

  it("alojamiento no muestra nada", () => {
    expect(formatModalidadesCobroAnuncio({ vertical: "alojamiento" }, [])).toBeNull();
  });
});
