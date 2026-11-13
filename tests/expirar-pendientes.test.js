import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/send-platform-email", () => ({
  sendPlatformEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/lib/notifications", () => ({
  notifyBookingEvent: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/lib/cancel-payment-intent-on-reject", () => ({
  cancelPaymentIntentOnReject: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: vi.fn(),
}));

import {
  EXPIRAR_ESTADO,
  EXPIRAR_RESOLUCION_TIPO,
  runExpirarPendientes,
} from "@/app/lib/cron/expirar-pendientes";

const NOW = new Date("2026-11-13T12:00:00.000Z");
const CUTOFF = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);

function hoursAgo(h) {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}

function makeBooking(overrides = {}) {
  return {
    id: "b1",
    service_id: "s1",
    cliente_id: "c1",
    payment_intent_id: "pi_1",
    estado: "pendiente",
    fecha_inicio: "2026-12-21",
    fecha_fin: null,
    precio_total: 114,
    credito_aplicado: 0,
    created_at: hoursAgo(60),
    resolucion_tipo: null,
    resolucion_nota: null,
    resolucion_at: null,
    ...overrides,
  };
}

/**
 * Supabase mock in-memory: bookings + services + profiles + disponibilidad.
 */
function createMockSupabase({ bookings, services, profiles }) {
  const store = {
    bookings: bookings.map((b) => ({ ...b })),
    services: services ?? [
      { id: "s1", proveedor_id: "p1", titulo: "Niñera test" },
    ],
    profiles: profiles ?? [
      { id: "c1", nombre: "Ana", apellido: "Cliente" },
      { id: "p1", nombre: "Pepe", apellido: "Proveedor" },
    ],
    disponibilidad: bookings.map((b) => ({ booking_id: b.id })),
  };

  function from(table) {
    return {
      select(_cols) {
        const ctx = { table, filters: {}, orFilter: null, orderAsc: true, lim: null, mode: "select" };
        return buildQuery(ctx);
      },
      update(patch) {
        const ctx = { table, filters: {}, patch, mode: "update" };
        return buildQuery(ctx);
      },
      delete() {
        const ctx = { table, filters: {}, mode: "delete" };
        return buildQuery(ctx);
      },
    };
  }

  function buildQuery(ctx) {
    const api = {
      eq(col, val) {
        ctx.filters[col] = val;
        return api;
      },
      or(expr) {
        ctx.orFilter = expr;
        return api;
      },
      order(_col, _opts) {
        return api;
      },
      limit(n) {
        ctx.lim = n;
        return api;
      },
      select(_cols) {
        // update().eq().eq().select()
        ctx.returning = true;
        return api.then ? api : Promise.resolve(run());
      },
      maybeSingle() {
        const { data, error } = run();
        if (error) return Promise.resolve({ data: null, error });
        return Promise.resolve({ data: data?.[0] ?? null, error: null });
      },
      then(resolve, reject) {
        try {
          resolve(run());
        } catch (e) {
          reject?.(e);
        }
      },
    };

    function matchesOr(row, orExpr) {
      if (!orExpr) return true;
      // created_at.lt.ISO,fecha_inicio.lt.YYYY-MM-DD
      const parts = orExpr.split(",");
      return parts.some((part) => {
        if (part.startsWith("created_at.lt.")) {
          const iso = part.slice("created_at.lt.".length);
          return row.created_at < iso;
        }
        if (part.startsWith("fecha_inicio.lt.")) {
          const day = part.slice("fecha_inicio.lt.".length);
          return row.fecha_inicio && row.fecha_inicio < day;
        }
        return false;
      });
    }

    function run() {
      if (ctx.table === "bookings" && ctx.mode === "select") {
        let rows = store.bookings.filter((b) => {
          for (const [k, v] of Object.entries(ctx.filters)) {
            if (b[k] !== v) return false;
          }
          return matchesOr(b, ctx.orFilter);
        });
        if (ctx.lim != null) rows = rows.slice(0, ctx.lim);
        return { data: rows.map((r) => ({ ...r })), error: null };
      }

      if (ctx.table === "bookings" && ctx.mode === "update") {
        const matched = [];
        for (const b of store.bookings) {
          let ok = true;
          for (const [k, v] of Object.entries(ctx.filters)) {
            if (b[k] !== v) ok = false;
          }
          if (!ok) continue;
          Object.assign(b, ctx.patch);
          matched.push({ id: b.id, estado: b.estado });
        }
        return { data: matched, error: null };
      }

      if (ctx.table === "disponibilidad" && ctx.mode === "delete") {
        store.disponibilidad = store.disponibilidad.filter((d) => {
          for (const [k, v] of Object.entries(ctx.filters)) {
            if (d[k] === v) return false;
          }
          return true;
        });
        return { data: null, error: null };
      }

      if (ctx.table === "services" && ctx.mode === "select") {
        const rows = store.services.filter((s) => {
          for (const [k, v] of Object.entries(ctx.filters)) {
            if (s[k] !== v) return false;
          }
          return true;
        });
        return { data: rows, error: null };
      }

      if (ctx.table === "profiles" && ctx.mode === "select") {
        const rows = store.profiles.filter((p) => {
          for (const [k, v] of Object.entries(ctx.filters)) {
            if (p[k] !== v) return false;
          }
          return true;
        });
        return { data: rows, error: null };
      }

      return { data: [], error: null };
    }

    return api;
  }

  return {
    from,
    _store: store,
  };
}

describe("runExpirarPendientes", () => {
  let cancelPayment;
  let notify;
  let sendEmail;

  beforeEach(() => {
    cancelPayment = vi.fn(async () => ({ ok: true, action: "canceled" }));
    notify = vi.fn(async () => ({ ok: true }));
    sendEmail = vi.fn(async () => {});
  });

  it("pendiente de más de 48 h expira y libera el pago", async () => {
    const booking = makeBooking({ created_at: hoursAgo(60) });
    const supabase = createMockSupabase({ bookings: [booking] });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    });

    expect(stats.expired).toBe(1);
    expect(cancelPayment).toHaveBeenCalledOnce();
    expect(cancelPayment.mock.calls[0][0].id).toBe("b1");
    expect(cancelPayment.mock.calls[0][1].idempotencyKey).toContain(
      "expirar-pendiente:b1",
    );
    expect(supabase._store.bookings[0].estado).toBe(EXPIRAR_ESTADO);
    expect(supabase._store.bookings[0].resolucion_tipo).toBe(
      EXPIRAR_RESOLUCION_TIPO,
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "reserva_expirada", cliente_id: "c1" }),
    );
    expect(notify).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ tipo: "reserva_expirada_cliente" }),
    );
    expect(notify).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ tipo: "reserva_expirada_proveedor" }),
    );
  });

  it("pendiente de menos de 48 h (y fecha futura) no se toca", async () => {
    const booking = makeBooking({
      created_at: hoursAgo(10),
      fecha_inicio: "2026-12-21",
    });
    const supabase = createMockSupabase({ bookings: [booking] });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    });

    expect(stats.scanned).toBe(0);
    expect(stats.expired).toBe(0);
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(supabase._store.bookings[0].estado).toBe("pendiente");
  });

  it("pendiente reciente pero con fecha_inicio ya pasada sí expira", async () => {
    const booking = makeBooking({
      created_at: hoursAgo(2),
      fecha_inicio: "2026-11-10",
    });
    const supabase = createMockSupabase({ bookings: [booking] });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    });

    expect(stats.expired).toBe(1);
    expect(supabase._store.bookings[0].estado).toBe(EXPIRAR_ESTADO);
  });

  it("confirmada o rechazada no se tocan", async () => {
    const supabase = createMockSupabase({
      bookings: [
        makeBooking({ id: "b-conf", estado: "confirmada", created_at: hoursAgo(100) }),
        makeBooking({ id: "b-rej", estado: "rechazada", created_at: hoursAgo(100) }),
      ],
    });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    });

    expect(stats.scanned).toBe(0);
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(supabase._store.bookings.map((b) => b.estado)).toEqual([
      "confirmada",
      "rechazada",
    ]);
  });

  it("segunda ejecución no hace nada (claim atómico)", async () => {
    const booking = makeBooking({ created_at: hoursAgo(72) });
    const supabase = createMockSupabase({ bookings: [booking] });
    const deps = {
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    };

    const first = await runExpirarPendientes(deps);
    expect(first.expired).toBe(1);
    expect(cancelPayment).toHaveBeenCalledTimes(1);

    const second = await runExpirarPendientes(deps);
    expect(second.scanned).toBe(0);
    expect(second.expired).toBe(0);
    expect(cancelPayment).toHaveBeenCalledTimes(1);
  });

  it("si la liberación del pago falla, se revierte a pendiente", async () => {
    cancelPayment.mockResolvedValue({
      ok: false,
      error: "stripe down",
      pi_status: "requires_capture",
    });
    const booking = makeBooking({ created_at: hoursAgo(72) });
    const supabase = createMockSupabase({ bookings: [booking] });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      notify,
      sendEmail,
    });

    expect(stats.reverted).toBe(1);
    expect(stats.expired).toBe(0);
    expect(supabase._store.bookings[0].estado).toBe("pendiente");
    expect(supabase._store.bookings[0].resolucion_tipo).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("created_at cutoff usa 48 h reales", () => {
    expect(CUTOFF.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});
