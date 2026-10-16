import { describe, expect, it } from "vitest";
import {
  formatCapacidadDisplayRow,
  formatCountLabel,
  getCapacidadDisplayRows,
  getCapacidadPersonas,
  serializeCapacidad,
  serviceMeetsCapacidadMin,
} from "@/app/lib/capacidad";
import { expandDisponibilidadAFechas } from "@/app/lib/tarifas";

describe("serializeCapacidad", () => {
  it("rellena valores por defecto en alojamiento", () => {
    expect(serializeCapacidad({}, "alojamiento")).toEqual({
      personas: 2,
      habitaciones: 1,
      camas: 1,
      banos: 1,
      bano_tipo: null,
    });
  });

  it("otras verticales no tienen capacidad", () => {
    expect(serializeCapacidad({}, "ninos")).toBeNull();
  });

  it("la capacidad máxima del precio manda sobre el JSON", () => {
    expect(
      serializeCapacidad({ capacidad_maxima: 6, capacidad: { personas: 3 } }, "alojamiento")
        .personas,
    ).toBe(6);
  });

  it("acota a mínimo 1 y redondea hacia abajo", () => {
    const r = serializeCapacidad(
      { capacidad: { habitaciones: 0, camas: "3.7", banos: -2 } },
      "alojamiento",
    );
    expect(r).toMatchObject({ habitaciones: 1, camas: 3, banos: 1 });
  });

  it("solo acepta tipos de baño conocidos", () => {
    expect(
      serializeCapacidad({ capacidad: { bano_tipo: "privado" } }, "alojamiento").bano_tipo,
    ).toBe("privado");
    expect(
      serializeCapacidad({ capacidad: { bano_tipo: "raro" } }, "alojamiento").bano_tipo,
    ).toBeNull();
  });
});

describe("getCapacidadPersonas", () => {
  it("prefiere la columna capacidad_maxima", () => {
    expect(getCapacidadPersonas({ capacidad_maxima: 5 })).toBe(5);
  });

  it("lee el JSON, incluso si llega como texto", () => {
    expect(getCapacidadPersonas({ capacidad: { personas: 3 } })).toBe(3);
    expect(getCapacidadPersonas({ capacidad: '{"personas":4}' })).toBe(4);
  });

  it("sin dato o JSON roto devuelve null", () => {
    expect(getCapacidadPersonas({})).toBeNull();
    expect(getCapacidadPersonas({ capacidad: "{roto" })).toBeNull();
    expect(getCapacidadPersonas({ capacidad: [1, 2] })).toBeNull();
  });
});

describe("textos de capacidad", () => {
  it("singular y plural", () => {
    expect(formatCountLabel(1, "cama", "camas")).toBe("1 cama");
    expect(formatCountLabel(3, "cama", "camas")).toBe("3 camas");
    expect(formatCountLabel("x", "cama", "camas")).toBe("0 camas");
  });

  it("filas para la ficha", () => {
    const rows = getCapacidadDisplayRows({
      capacidad: { personas: 2, habitaciones: 1, camas: 1, banos: 1, bano_tipo: "privado" },
    });
    expect(rows.map(formatCapacidadDisplayRow)).toEqual([
      "2 personas",
      "1 habitación",
      "1 cama",
      "1 baño",
      "Baño privado",
    ]);
  });

  it("sin capacidad no hay filas", () => {
    expect(getCapacidadDisplayRows({})).toEqual([]);
  });
});

describe("serviceMeetsCapacidadMin", () => {
  const aloj = { vertical: "alojamiento", capacidad_maxima: 2 };

  it("exige el mínimo de personas en alojamiento", () => {
    expect(serviceMeetsCapacidadMin(aloj, 2)).toBe(true);
    expect(serviceMeetsCapacidadMin(aloj, 4)).toBe(false);
  });

  it("no filtra si no hay dato, el mínimo es 1 o no es alojamiento", () => {
    expect(serviceMeetsCapacidadMin({ vertical: "alojamiento" }, 4)).toBe(true);
    expect(serviceMeetsCapacidadMin(aloj, 1)).toBe(true);
    expect(serviceMeetsCapacidadMin({ vertical: "ninos", capacidad_maxima: 1 }, 4)).toBe(true);
  });
});

describe("expandDisponibilidadAFechas", () => {
  const desde = "2026-09-01";
  const hasta = "2026-09-30";

  it("expande el rango con ambos extremos incluidos", () => {
    expect(
      expandDisponibilidadAFechas(
        [{ fecha_inicio: "2026-09-10", fecha_fin: "2026-09-12" }],
        desde,
        hasta,
      ),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("sin fecha_fin es un solo día", () => {
    expect(
      expandDisponibilidadAFechas([{ fecha_inicio: "2026-09-10" }], desde, hasta),
    ).toEqual(["2026-09-10"]);
  });

  it("recorta a la ventana pedida", () => {
    expect(
      expandDisponibilidadAFechas(
        [{ fecha_inicio: "2026-08-28", fecha_fin: "2026-09-02" }],
        desde,
        hasta,
      ),
    ).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("cruza el fin de mes y de año sin saltarse días", () => {
    expect(
      expandDisponibilidadAFechas(
        [{ fecha_inicio: "2026-12-30", fecha_fin: "2027-01-02" }],
        "2026-12-01",
        "2027-01-31",
      ),
    ).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("junta rangos solapados sin duplicados y ordenados", () => {
    expect(
      expandDisponibilidadAFechas(
        [
          { fecha_inicio: "2026-09-12", fecha_fin: "2026-09-13" },
          { fecha_inicio: "2026-09-10", fecha_fin: "2026-09-12" },
        ],
        desde,
        hasta,
      ),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]);
  });

  it("acepta fechas con hora y entrada vacía", () => {
    expect(
      expandDisponibilidadAFechas(
        [{ fecha_inicio: "2026-09-10T00:00:00+00:00", fecha_fin: "2026-09-10T00:00:00+00:00" }],
        desde,
        hasta,
      ),
    ).toEqual(["2026-09-10"]);
    expect(expandDisponibilidadAFechas(null, desde, hasta)).toEqual([]);
  });
});
