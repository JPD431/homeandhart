import { describe, expect, it } from "vitest";
import {
  getRefundPercent,
  getServiceStartDateTime,
  normalizeCancelPolicy,
} from "@/app/lib/cancelacion-politica";

const HOUR = 60 * 60 * 1000;
const start = new Date(2026, 8, 10, 0, 0, 0, 0);
const hoursBefore = (h) => new Date(start.getTime() - h * HOUR);

describe("normalizeCancelPolicy", () => {
  it("traduce los nombres antiguos", () => {
    expect(normalizeCancelPolicy("24h")).toBe("flexible");
    expect(normalizeCancelPolicy("48h")).toBe("moderada");
    expect(normalizeCancelPolicy("7d")).toBe("estricta");
  });

  it("deja pasar los nombres actuales y desconocidos", () => {
    expect(normalizeCancelPolicy("flexible")).toBe("flexible");
    expect(normalizeCancelPolicy("none")).toBe("none");
  });
});

describe("getServiceStartDateTime", () => {
  it("alojamiento empieza a medianoche", () => {
    const d = getServiceStartDateTime("alojamiento", "2026-09-10", null);
    expect(d).toEqual(new Date(2026, 8, 10, 0, 0));
  });

  it("niños usa la hora indicada", () => {
    const d = getServiceStartDateTime("ninos", "2026-09-10", "14:30");
    expect(d).toEqual(new Date(2026, 8, 10, 14, 30));
  });

  it("niños sin hora o sin fecha no tiene inicio", () => {
    expect(getServiceStartDateTime("ninos", "2026-09-10", null)).toBeNull();
    expect(getServiceStartDateTime("alojamiento", null, null)).toBeNull();
  });
});

describe("getRefundPercent", () => {
  it("flexible: 100 % con más de 24 h, 50 % después", () => {
    expect(getRefundPercent("flexible", hoursBefore(25), start)).toBe(100);
    expect(getRefundPercent("flexible", hoursBefore(24), start)).toBe(50);
    expect(getRefundPercent("flexible", hoursBefore(2), start)).toBe(50);
  });

  it("moderada: 100 % con más de 3 días, 50 % hasta 24 h, 0 % después", () => {
    expect(getRefundPercent("moderada", hoursBefore(73), start)).toBe(100);
    expect(getRefundPercent("moderada", hoursBefore(72), start)).toBe(50);
    expect(getRefundPercent("moderada", hoursBefore(25), start)).toBe(50);
    expect(getRefundPercent("moderada", hoursBefore(24), start)).toBe(0);
  });

  it("estricta: 100 % con más de 7 días, 50 % con más de 3, 0 % después", () => {
    expect(getRefundPercent("estricta", hoursBefore(169), start)).toBe(100);
    expect(getRefundPercent("estricta", hoursBefore(168), start)).toBe(50);
    expect(getRefundPercent("estricta", hoursBefore(73), start)).toBe(50);
    expect(getRefundPercent("estricta", hoursBefore(72), start)).toBe(0);
  });

  it("los nombres antiguos se comportan como los nuevos", () => {
    expect(getRefundPercent("24h", hoursBefore(25), start)).toBe(100);
    expect(getRefundPercent("7d", hoursBefore(100), start)).toBe(50);
  });

  it("nunca reembolsa si ya empezó, sin política o sin fecha", () => {
    expect(getRefundPercent("flexible", start, start)).toBe(0);
    expect(getRefundPercent("flexible", hoursBefore(-5), start)).toBe(0);
    expect(getRefundPercent("none", hoursBefore(500), start)).toBe(0);
    expect(getRefundPercent("inventada", hoursBefore(500), start)).toBe(0);
    expect(getRefundPercent("flexible", hoursBefore(500), null)).toBe(0);
  });
});
