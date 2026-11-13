import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { devolverCreditoCliente } = vi.hoisted(() => ({
  devolverCreditoCliente: vi.fn(),
}));

vi.mock("@/app/lib/stripe-reembolso", () => ({
  roundMoney: (n) => Math.round(Number(n) * 100) / 100,
  devolverCreditoCliente: (...args) => devolverCreditoCliente(...args),
}));

import {
  creditIdempotencyKeyRejectOrExpire,
  devolverCreditoReservaPendiente,
} from "@/app/lib/devolver-credito-reserva-pendiente";
import { getBookingStatusMeta } from "@/app/lib/booking-display";

function makeSupabase({ updateError = null } = {}) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(async () => ({ error: updateError })),
    })),
  }));
  return {
    from: vi.fn(() => ({ update })),
    _update: update,
  };
}

describe("devolverCreditoReservaPendiente", () => {
  beforeEach(() => {
    devolverCreditoCliente.mockReset();
    devolverCreditoCliente.mockResolvedValue(20);
  });

  it("no hace nada sin credito_aplicado", async () => {
    const supabase = makeSupabase();
    const result = await devolverCreditoReservaPendiente(supabase, {
      id: "b1",
      cliente_id: "c1",
      credito_aplicado: 0,
      precio_total: 100,
    });
    expect(result).toEqual({
      credito_devuelto: 0,
      skipped: true,
      reason: "sin_credito",
    });
    expect(devolverCreditoCliente).not.toHaveBeenCalled();
  });

  it("devuelve crédito con clave idempotente estable", async () => {
    const supabase = makeSupabase();
    const booking = {
      id: "b1",
      cliente_id: "c1",
      credito_aplicado: 20,
      precio_total: 114,
    };

    const result = await devolverCreditoReservaPendiente(
      supabase,
      booking,
      "[test]",
    );

    expect(result.credito_devuelto).toBe(20);
    expect(devolverCreditoCliente).toHaveBeenCalledWith(
      supabase,
      "c1",
      20,
      "[test]",
      { idempotencyKey: "credit:reject-or-expire:b1" },
    );
    expect(creditIdempotencyKeyRejectOrExpire("b1")).toBe(
      "credit:reject-or-expire:b1",
    );
  });

  it("segunda llamada reutiliza la misma key (no doble abono a nivel de llamada)", async () => {
    const supabase = makeSupabase();
    // Simula RPC: segundo call con misma key → mismo amount, sin re-abonar
    devolverCreditoCliente
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(15);

    const booking = {
      id: "b2",
      cliente_id: "c1",
      credito_aplicado: 15,
      precio_total: 80,
    };

    await devolverCreditoReservaPendiente(supabase, booking, "[test]");
    await devolverCreditoReservaPendiente(supabase, booking, "[test]");

    expect(devolverCreditoCliente).toHaveBeenCalledTimes(2);
    expect(devolverCreditoCliente.mock.calls[0][4]).toEqual(
      devolverCreditoCliente.mock.calls[1][4],
    );
    expect(devolverCreditoCliente.mock.calls[0][4].idempotencyKey).toBe(
      "credit:reject-or-expire:b2",
    );
  });
});

describe("getBookingStatusMeta · caducada", () => {
  it("muestra Caducada si rechazada + resolucion_tipo expirada_sin_respuesta", () => {
    const meta = getBookingStatusMeta(
      { estado: "rechazada", resolucion_tipo: "expirada_sin_respuesta" },
      { role: "cliente" },
    );
    expect(meta.key).toBe("caducada");
    expect(meta.label).toBe("Caducada");
  });

  it("sigue Rechazada si no hay resolucion de caducidad", () => {
    const meta = getBookingStatusMeta(
      { estado: "rechazada", resolucion_tipo: null },
      { role: "proveedor" },
    );
    expect(meta.key).toBe("rechazada");
    expect(meta.label).toBe("Rechazada");
  });
});
