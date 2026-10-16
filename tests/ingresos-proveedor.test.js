import { describe, expect, it } from "vitest";
import {
  getBookingPrecioBase,
  getIngresoProveedor,
  getIngresoProveedorFromBooking,
  getPrecioBaseProveedor,
  roundMoney,
} from "@/app/lib/ingresos-proveedor";

describe("roundMoney", () => {
  it("redondea a 2 decimales", () => {
    expect(roundMoney(1.234)).toBe(1.23);
    expect(roundMoney(1.236)).toBe(1.24);
    expect(roundMoney("2.5")).toBe(2.5);
  });
});

describe("importes del proveedor", () => {
  it("la base es el total entre 1,14 (comisión de cliente 14 %)", () => {
    expect(roundMoney(getPrecioBaseProveedor(114))).toBe(100);
    expect(getPrecioBaseProveedor(null)).toBe(0);
  });

  it("el proveedor cobra el 96 % de la base (4 % de comisión de anfitrión)", () => {
    expect(getIngresoProveedor(114)).toBe(96);
  });

  it("sin comisión cobra el 100 % de la base", () => {
    expect(getIngresoProveedor(114, { sinComision: true })).toBe(100);
  });
});

describe("getBookingPrecioBase", () => {
  it("usa precio_base cuando existe", () => {
    expect(getBookingPrecioBase({ precio_base: 100, precio_total: 999 })).toBe(100);
  });

  it("infiere la base en reservas antiguas", () => {
    expect(getBookingPrecioBase({ precio_total: 114 })).toBe(100);
  });

  it("cliente sin comisión: el total ya es la base", () => {
    expect(
      getBookingPrecioBase({ precio_total: 100, cliente_sin_comision: true }),
    ).toBe(100);
  });
});

describe("getIngresoProveedorFromBooking", () => {
  it("aplica la comisión por defecto", () => {
    expect(getIngresoProveedorFromBooking({ precio_total: 114 })).toBe(96);
  });

  it("proveedor_sin_comision en la reserva", () => {
    expect(
      getIngresoProveedorFromBooking({
        precio_total: 114,
        proveedor_sin_comision: true,
      }),
    ).toBe(100);
  });

  it("la opción explícita manda sobre la reserva", () => {
    expect(
      getIngresoProveedorFromBooking(
        { precio_total: 114, proveedor_sin_comision: true },
        { sinComisionProveedor: false },
      ),
    ).toBe(96);
  });
});
