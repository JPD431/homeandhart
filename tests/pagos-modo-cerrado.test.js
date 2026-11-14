import { afterEach, describe, expect, it } from "vitest";
import {
  getPagosAllowlist,
  isPagoPermitido,
} from "@/app/lib/pagos-modo-cerrado";

const ORIGINAL = process.env.PAGOS_SOLO_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PAGOS_SOLO_EMAILS;
  else process.env.PAGOS_SOLO_EMAILS = ORIGINAL;
});

describe("getPagosAllowlist", () => {
  it("sin variable → null (modo abierto)", () => {
    delete process.env.PAGOS_SOLO_EMAILS;
    expect(getPagosAllowlist()).toBeNull();
  });

  it("lista vacía o solo espacios → null", () => {
    process.env.PAGOS_SOLO_EMAILS = "";
    expect(getPagosAllowlist()).toBeNull();
    process.env.PAGOS_SOLO_EMAILS = "  ,  , ";
    expect(getPagosAllowlist()).toBeNull();
  });

  it("normaliza minúsculas, trim e ignora vacíos", () => {
    process.env.PAGOS_SOLO_EMAILS =
      " Ana@Homeandheart.es , ,socio@test.com ";
    expect(getPagosAllowlist()).toEqual([
      "ana@homeandheart.es",
      "socio@test.com",
    ]);
  });
});

describe("isPagoPermitido", () => {
  it("sin variable → permitido para cualquier email", () => {
    delete process.env.PAGOS_SOLO_EMAILS;
    expect(isPagoPermitido("cualquiera@ejemplo.com")).toBe(true);
    expect(isPagoPermitido(null)).toBe(true);
  });

  it("con lista → solo emails permitidos (case/espacios)", () => {
    process.env.PAGOS_SOLO_EMAILS = "yo@homeandheart.es, socio@test.com";
    expect(isPagoPermitido("yo@homeandheart.es")).toBe(true);
    expect(isPagoPermitido(" YO@Homeandheart.es ")).toBe(true);
    expect(isPagoPermitido("socio@test.com")).toBe(true);
    expect(isPagoPermitido("otro@test.com")).toBe(false);
    expect(isPagoPermitido("")).toBe(false);
    expect(isPagoPermitido(null)).toBe(false);
  });

  it("lista vacía → modo abierto", () => {
    process.env.PAGOS_SOLO_EMAILS = "   ";
    expect(isPagoPermitido("cualquiera@ejemplo.com")).toBe(true);
  });
});
