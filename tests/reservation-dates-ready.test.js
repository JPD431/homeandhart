import { describe, expect, it } from "vitest";
import {
  areReservationDatesReady,
  formatReservationDatesBlockedMessage,
  getLocalTodayStr,
  getMinHoraForFecha,
  getReservationDatesStatus,
  normalizeTimeInputValue,
} from "@/app/lib/reservation-dates-ready";

const DEC_21 = "2026-12-21";
const DEC_25 = "2026-12-25";
const NOW_NOV = new Date(2026, 10, 13, 15, 0, 0); // 13 nov 2026 15:00 local

describe("normalizeTimeInputValue", () => {
  it("acepta HH:mm y HH:mm:ss, incluido 12:30", () => {
    expect(normalizeTimeInputValue("12:30")).toBe("12:30");
    expect(normalizeTimeInputValue("12:30:00")).toBe("12:30");
    expect(normalizeTimeInputValue("9:05")).toBe("09:05");
  });

  it("trata vacío / basura como no elegido (caso Safari fantasma 12:30)", () => {
    expect(normalizeTimeInputValue("")).toBe("");
    expect(normalizeTimeInputValue(null)).toBe("");
    expect(normalizeTimeInputValue("  ")).toBe("");
    expect(normalizeTimeInputValue("abc")).toBe("");
  });
});

describe("getMinHoraForFecha usa día local (no UTC)", () => {
  it("no impone mínimo en fecha futura", () => {
    expect(getMinHoraForFecha(DEC_21, NOW_NOV)).toBeUndefined();
  });

  it("impone ahora+1h si la fecha es hoy local", () => {
    const hoy = getLocalTodayStr(NOW_NOV);
    expect(getMinHoraForFecha(hoy, NOW_NOV)).toBe("16:00");
  });
});

describe("niñeras (ninos) · modalidad por hora", () => {
  const billingHora = { kind: "modalidad", modalidad: "hora", row: {} };
  const base = {
    fechaInicio: DEC_21,
    fechaFin: DEC_25,
    vertical: "ninos",
    mainBilling: billingHora,
    serviceModalidad: "domicilio_cliente",
    lugarServicio: "casa_cliente",
    now: NOW_NOV,
  };

  it("bloquea si hora está vacía aunque el UI pueda mostrar 12:30", () => {
    const status = getReservationDatesStatus({
      ...base,
      hora: "",
      duracionHoras: "1",
    });
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("hora");
    expect(formatReservationDatesBlockedMessage(status)).toMatch(/hora/i);
  });

  it("abre con 12:30 real en estado + duración 1 (rango multi-día)", () => {
    expect(
      areReservationDatesReady({
        ...base,
        hora: "12:30",
        duracionHoras: "1",
      }),
    ).toBe(true);
  });

  it("abre con otras horas (p. ej. 14:00)", () => {
    expect(
      areReservationDatesReady({
        ...base,
        hora: "14:00",
        duracionHoras: "1",
      }),
    ).toBe(true);
  });

  it("no exige fechaFin en cobro por hora", () => {
    expect(
      areReservationDatesReady({
        ...base,
        fechaFin: "",
        hora: "12:30",
        duracionHoras: "2",
      }),
    ).toBe(true);
  });

  it("exige duración", () => {
    const status = getReservationDatesStatus({
      ...base,
      hora: "12:30",
      duracionHoras: "",
    });
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("duracionHoras");
  });
});

describe("niñeras (ninos) · legacy", () => {
  const base = {
    fechaInicio: DEC_21,
    vertical: "ninos",
    mainBilling: { kind: "legacy" },
    now: NOW_NOV,
  };

  it("exige hora y duración; 12:30 cuenta cuando está en estado", () => {
    expect(
      areReservationDatesReady({
        ...base,
        hora: "12:30",
        duracionHoras: "1",
      }),
    ).toBe(true);
    expect(
      areReservationDatesReady({
        ...base,
        hora: "",
        duracionHoras: "1",
      }),
    ).toBe(false);
  });
});

describe("mascotas · modalidad por hora (paseos)", () => {
  const billingHora = { kind: "modalidad", modalidad: "hora", row: {} };
  const base = {
    fechaInicio: DEC_21,
    fechaFin: "",
    vertical: "mascotas",
    mainBilling: billingHora,
    serviceModalidad: "paseos",
    lugarServicio: "casa_cliente",
    now: NOW_NOV,
  };

  it("12:30 + duración desbloquea; vacío no", () => {
    expect(
      areReservationDatesReady({
        ...base,
        hora: "12:30",
        duracionHoras: "1",
      }),
    ).toBe(true);
    expect(
      areReservationDatesReady({
        ...base,
        hora: "",
        duracionHoras: "1",
      }),
    ).toBe(false);
  });
});

describe("mascotas · modalidad medio_dia", () => {
  const billing = { kind: "modalidad", modalidad: "medio_dia", row: {} };
  const base = {
    fechaInicio: DEC_21,
    fechaFin: DEC_25,
    vertical: "mascotas",
    mainBilling: billing,
    serviceModalidad: "paseos",
    lugarServicio: "casa_cliente",
    now: NOW_NOV,
  };

  it("exige hora y fechaFin; no duración; 12:30 válido en estado", () => {
    expect(
      areReservationDatesReady({
        ...base,
        hora: "12:30",
        duracionHoras: "",
      }),
    ).toBe(true);

    expect(
      areReservationDatesReady({
        ...base,
        fechaFin: "",
        hora: "12:30",
      }),
    ).toBe(false);

    expect(
      areReservationDatesReady({
        ...base,
        hora: "",
      }),
    ).toBe(false);
  });
});

describe("mascotas · legacy (por día)", () => {
  it("solo exige fechaFin; no hora", () => {
    expect(
      areReservationDatesReady({
        fechaInicio: DEC_21,
        fechaFin: DEC_25,
        hora: "",
        vertical: "mascotas",
        mainBilling: { kind: "legacy" },
        now: NOW_NOV,
      }),
    ).toBe(true);

    expect(
      areReservationDatesReady({
        fechaInicio: DEC_21,
        fechaFin: "",
        vertical: "mascotas",
        mainBilling: { kind: "legacy" },
        now: NOW_NOV,
      }),
    ).toBe(false);
  });
});

describe("hora inválida hoy → aviso, no silencio", () => {
  it("marca past_min y mensaje con hora mínima", () => {
    const hoy = getLocalTodayStr(NOW_NOV);
    const status = getReservationDatesStatus({
      fechaInicio: hoy,
      hora: "12:30",
      duracionHoras: "1",
      vertical: "ninos",
      mainBilling: { kind: "modalidad", modalidad: "hora", row: {} },
      now: NOW_NOV, // 15:00 → min 16:00
    });
    expect(status.ready).toBe(false);
    expect(status.horaInvalid).toBe("past_min");
    expect(status.minHora).toBe("16:00");
    expect(formatReservationDatesBlockedMessage(status)).toMatch(/16:00/);
  });
});

describe("lugar ambas sin elegir", () => {
  it("bloquea hasta elegir lugar", () => {
    const status = getReservationDatesStatus({
      fechaInicio: DEC_21,
      hora: "12:30",
      duracionHoras: "1",
      vertical: "ninos",
      mainBilling: { kind: "modalidad", modalidad: "hora", row: {} },
      serviceModalidad: "ambas",
      lugarServicio: null,
      now: NOW_NOV,
    });
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("lugarServicio");
  });
});

describe("selector de modalidad sin elegir", () => {
  it("bloquea si hay varias modalidades y no hay elección", () => {
    const status = getReservationDatesStatus({
      fechaInicio: DEC_21,
      hora: "12:30",
      duracionHoras: "1",
      vertical: "ninos",
      showModalidadSelector: true,
      modalidadCobro: null,
      mainBilling: { kind: "legacy" },
      now: NOW_NOV,
    });
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("modalidadCobro");
  });
});
