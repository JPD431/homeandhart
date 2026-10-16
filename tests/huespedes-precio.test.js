import { describe, expect, it } from "vitest";
import {
  formatHuespedesPrecioDesglose,
  formatHuespedesPrecioInfo,
  getHuespedesSuplementoPorNoche,
  parseHuespedesPrecioFromDb,
  serializeHuespedesPrecioForDb,
  serviceHasHuespedesModelo,
  serviceNeedsUnidadesSelector,
  validateHuespedesPrecio,
  validateNumHuespedesParaReserva,
} from "@/app/lib/huespedes-precio";

const ninos = {
  vertical: "ninos",
  capacidad_maxima: 4,
  huespedes_incluidos: 1,
  precio_huesped_extra: 8,
};

describe("serviceHasHuespedesModelo", () => {
  it("necesita máximo, incluidos y suplemento mayores que 0", () => {
    expect(serviceHasHuespedesModelo(ninos)).toBe(true);
    expect(serviceHasHuespedesModelo({ ...ninos, precio_huesped_extra: 0 })).toBe(false);
    expect(serviceHasHuespedesModelo({ ...ninos, huespedes_incluidos: null })).toBe(false);
    expect(serviceHasHuespedesModelo({ ...ninos, capacidad_maxima: 0 })).toBe(false);
  });

  it("solo aplica a alojamiento, niños y mascotas", () => {
    expect(serviceHasHuespedesModelo({ ...ninos, vertical: "otro" })).toBe(false);
    expect(serviceHasHuespedesModelo(null)).toBe(false);
  });
});

describe("getHuespedesSuplementoPorNoche", () => {
  it("cobra solo las unidades por encima de las incluidas", () => {
    expect(getHuespedesSuplementoPorNoche(ninos, 3)).toBe(16);
    expect(getHuespedesSuplementoPorNoche(ninos, 2)).toBe(8);
  });

  it("sin extras, sin dato o dato inválido no hay suplemento", () => {
    expect(getHuespedesSuplementoPorNoche(ninos, 1)).toBe(0);
    expect(getHuespedesSuplementoPorNoche(ninos, undefined)).toBe(0);
    expect(getHuespedesSuplementoPorNoche(ninos, "abc")).toBe(0);
  });

  it("un servicio de precio plano nunca tiene suplemento", () => {
    expect(getHuespedesSuplementoPorNoche({ vertical: "ninos" }, 5)).toBe(0);
  });
});

describe("serviceNeedsUnidadesSelector", () => {
  it("modelo completo muestra el selector", () => {
    expect(serviceNeedsUnidadesSelector(ninos)).toBe(true);
  });

  it("capacidad con suplemento en una modalidad también", () => {
    const svc = {
      vertical: "mascotas",
      capacidad_maxima: 3,
      huespedes_incluidos: 1,
      modalidades: [{ modalidad: "dia", suplemento_extra: 2 }],
    };
    expect(serviceNeedsUnidadesSelector(svc)).toBe(true);
    expect(
      serviceNeedsUnidadesSelector({
        ...svc,
        modalidades: [{ modalidad: "dia", suplemento_extra: 0 }],
      }),
    ).toBe(false);
  });
});

describe("validateNumHuespedesParaReserva", () => {
  it("acepta un número válido, también como texto", () => {
    expect(validateNumHuespedesParaReserva(ninos, 2)).toEqual({ ok: true, num: 2 });
    expect(validateNumHuespedesParaReserva(ninos, "2")).toEqual({ ok: true, num: 2 });
  });

  it("sin dato usa los incluidos", () => {
    expect(validateNumHuespedesParaReserva(ninos, null)).toEqual({ ok: true, num: 1 });
  });

  it("rechaza por encima del máximo", () => {
    expect(validateNumHuespedesParaReserva(ninos, 5)).toEqual({
      ok: false,
      error: "Este servicio admite un máximo de 4 niños.",
    });
  });

  it("rechaza cero, decimales y texto", () => {
    expect(validateNumHuespedesParaReserva(ninos, 0)).toEqual({
      ok: false,
      error: "Debe haber al menos 1 niño.",
    });
    expect(validateNumHuespedesParaReserva(ninos, 2.5).ok).toBe(false);
    expect(validateNumHuespedesParaReserva(ninos, "abc").ok).toBe(false);
  });

  it("servicios sin modelo no restringen", () => {
    expect(validateNumHuespedesParaReserva({ vertical: "ninos" }, 9)).toEqual({
      ok: true,
      num: null,
    });
  });
});

describe("formatHuespedesPrecioDesglose", () => {
  it("niños: unidad hora", () => {
    expect(formatHuespedesPrecioDesglose(ninos, 3)).toBe(
      "1 niño incluido · +2 niños × 8€ = +16€/hora",
    );
  });

  it("sin extras muestra solo los incluidos", () => {
    expect(formatHuespedesPrecioDesglose(ninos, 1)).toBe("1 niño incluido");
  });

  it("mascotas: unidad día y género femenino", () => {
    const mascotas = {
      vertical: "mascotas",
      capacidad_maxima: 3,
      huespedes_incluidos: 1,
      precio_huesped_extra: 5,
    };
    expect(formatHuespedesPrecioDesglose(mascotas, 2)).toBe(
      "1 mascota incluida · +1 mascota × 5€ = +5€/día",
    );
  });

  it("usa el suplemento y la unidad de la modalidad elegida", () => {
    const svc = {
      vertical: "ninos",
      capacidad_maxima: 3,
      huespedes_incluidos: 1,
      modalidades: [{ modalidad: "medio_dia", precio: 20, suplemento_extra: 2.95 }],
    };
    expect(formatHuespedesPrecioDesglose(svc, 2, "medio_dia")).toBe(
      "1 niño incluido · +1 niño × 2.95€ = +2.95€/medio día",
    );
  });

  it("devuelve null si el servicio no usa unidades", () => {
    expect(formatHuespedesPrecioDesglose({ vertical: "ninos" }, 2)).toBeNull();
    expect(formatHuespedesPrecioDesglose(null, 2)).toBeNull();
  });
});

describe("formatHuespedesPrecioInfo", () => {
  it("resume capacidad, incluidos y suplemento", () => {
    expect(formatHuespedesPrecioInfo(ninos)).toBe(
      "Hasta 4 niños · incluye 1 · +8€/hora por niño adicional",
    );
  });

  it("sin datos devuelve null", () => {
    expect(formatHuespedesPrecioInfo({ vertical: "ninos" })).toBeNull();
  });
});

describe("serializeHuespedesPrecioForDb", () => {
  it("convierte formulario a columnas numéricas", () => {
    expect(
      serializeHuespedesPrecioForDb(
        { capacidad_maxima: "4", huespedes_incluidos: "1", precio_huesped_extra: "8.5" },
        "ninos",
      ),
    ).toEqual({ capacidad_maxima: 4, huespedes_incluidos: 1, precio_huesped_extra: 8.5 });
  });

  it("suplemento 0 se guarda como NULL", () => {
    expect(
      serializeHuespedesPrecioForDb({ precio_huesped_extra: "0" }, "ninos")
        .precio_huesped_extra,
    ).toBeNull();
  });

  it("otras verticales guardan todo NULL", () => {
    expect(
      serializeHuespedesPrecioForDb({ capacidad_maxima: "4" }, "otro"),
    ).toEqual({
      capacidad_maxima: null,
      huespedes_incluidos: null,
      precio_huesped_extra: null,
    });
  });
});

describe("parseHuespedesPrecioFromDb", () => {
  it("alojamiento recupera la capacidad antigua del JSON", () => {
    expect(
      parseHuespedesPrecioFromDb({ vertical: "alojamiento", capacidad: { personas: 4 } })
        .capacidad_maxima,
    ).toBe("4");
  });

  it("otras verticales no usan ese respaldo", () => {
    expect(
      parseHuespedesPrecioFromDb({ vertical: "ninos", capacidad: { personas: 4 } })
        .capacidad_maxima,
    ).toBe("");
  });
});

describe("validateHuespedesPrecio", () => {
  it("el máximo no puede ser menor que los incluidos", () => {
    expect(
      validateHuespedesPrecio({ capacidad_maxima: 1, huespedes_incluidos: 3 }, "ninos"),
    ).toBe(
      "El máximo de niños debe ser mayor o igual que los niños incluidos en el precio.",
    );
  });

  it("el suplemento no puede ser negativo", () => {
    expect(validateHuespedesPrecio({ precio_huesped_extra: "-1" }, "ninos")).toBe(
      "El precio por niño adicional no puede ser negativo.",
    );
  });

  it("con suplemento y máximo hay que indicar los incluidos", () => {
    expect(
      validateHuespedesPrecio(
        { capacidad_maxima: 4, precio_huesped_extra: "5" },
        "ninos",
      ),
    ).toBe("Indica cuántos niños incluye el precio base.");
  });

  it("datos correctos o vertical sin unidades: sin error", () => {
    expect(
      validateHuespedesPrecio(
        { capacidad_maxima: 4, huespedes_incluidos: 1, precio_huesped_extra: "5" },
        "ninos",
      ),
    ).toBeNull();
    expect(validateHuespedesPrecio({}, "otro")).toBeNull();
  });
});
