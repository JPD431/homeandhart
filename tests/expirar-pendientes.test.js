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
  buildBrokenExpirarPendientesOrFilter,
  cutoffCreatedAtIso,
  fetchPendientesExpirables,
  postgrestUnquotedOrValueAfterLt,
  runExpirarPendientes,
  todayUtcDateString,
} from "@/app/lib/cron/expirar-pendientes";
import { buildCronSummary, taskSucceeded } from "@/app/lib/cron/diario";

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
        ctx.filters[col] = { op: "eq", val };
        return api;
      },
      lt(col, val) {
        ctx.filters[col] = { op: "lt", val };
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

    function matchesFilter(row, col, spec) {
      if (spec == null) return true;
      if (typeof spec !== "object" || !spec.op) {
        return row[col] === spec;
      }
      if (spec.op === "eq") return row[col] === spec.val;
      if (spec.op === "lt") {
        const left = row[col];
        if (left == null) return false;
        return String(left) < String(spec.val);
      }
      return false;
    }

    function run() {
      if (ctx.table === "bookings" && ctx.mode === "select") {
        let rows = store.bookings.filter((b) => {
          for (const [k, spec] of Object.entries(ctx.filters)) {
            if (!matchesFilter(b, k, spec)) return false;
          }
          return true;
        });
        if (ctx.lim != null) rows = rows.slice(0, ctx.lim);
        return { data: rows.map((r) => ({ ...r })), error: null };
      }

      if (ctx.table === "bookings" && ctx.mode === "update") {
        const matched = [];
        for (const b of store.bookings) {
          let ok = true;
          for (const [k, spec] of Object.entries(ctx.filters)) {
            if (!matchesFilter(b, k, spec)) ok = false;
          }
          if (!ok) continue;
          Object.assign(b, ctx.patch);
          matched.push({ id: b.id, estado: b.estado });
        }
        return { data: matched, error: null };
      }

      if (ctx.table === "disponibilidad" && ctx.mode === "delete") {
        store.disponibilidad = store.disponibilidad.filter((d) => {
          for (const [k, spec] of Object.entries(ctx.filters)) {
            const val = typeof spec === "object" && spec?.op ? spec.val : spec;
            if (d[k] === val) return false;
          }
          return true;
        });
        return { data: null, error: null };
      }

      if (ctx.table === "services" && ctx.mode === "select") {
        const rows = store.services.filter((s) => {
          for (const [k, spec] of Object.entries(ctx.filters)) {
            if (!matchesFilter(s, k, spec)) return false;
          }
          return true;
        });
        return { data: rows, error: null };
      }

      if (ctx.table === "profiles" && ctx.mode === "select") {
        const rows = store.profiles.filter((p) => {
          for (const [k, spec] of Object.entries(ctx.filters)) {
            if (!matchesFilter(p, k, spec)) return false;
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
  let devolverCredito;
  let notify;
  let sendEmail;

  beforeEach(() => {
    cancelPayment = vi.fn(async () => ({ ok: true, action: "canceled" }));
    devolverCredito = vi.fn(async () => ({
      credito_devuelto: 0,
      skipped: true,
    }));
    notify = vi.fn(async () => ({ ok: true }));
    sendEmail = vi.fn(async () => {});
  });

  it("pendiente de más de 48 h expira y libera el pago", async () => {
    const booking = makeBooking({
      created_at: hoursAgo(60),
      credito_aplicado: 25,
    });
    const supabase = createMockSupabase({ bookings: [booking] });

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      devolverCredito,
      notify,
      sendEmail,
    });

    expect(stats.expired).toBe(1);
    expect(cancelPayment).toHaveBeenCalledOnce();
    expect(cancelPayment.mock.calls[0][0].id).toBe("b1");
    expect(cancelPayment.mock.calls[0][1].idempotencyKey).toContain(
      "expirar-pendiente:b1",
    );
    expect(devolverCredito).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ id: "b1", credito_aplicado: 25 }),
      "[cron/expirar-pendientes]",
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
      devolverCredito,
      notify,
      sendEmail,
    });

    expect(stats.scanned).toBe(0);
    expect(stats.expired).toBe(0);
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(devolverCredito).not.toHaveBeenCalled();
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
      devolverCredito,
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
      devolverCredito,
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
      devolverCredito,
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
      devolverCredito,
      notify,
      sendEmail,
    });

    expect(stats.reverted).toBe(1);
    expect(stats.expired).toBe(0);
    expect(supabase._store.bookings[0].estado).toBe("pendiente");
    expect(supabase._store.bookings[0].resolucion_tipo).toBeNull();
    expect(devolverCredito).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("created_at cutoff usa 48 h reales", () => {
    expect(CUTOFF.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });

  it("caso preview: pendiente con created_at 9-nov y fecha futura SÍ se encuentra y expira", async () => {
    // Reproducción del fallo en preview: created_at forzado a 2026-11-09,
    // fecha_inicio futura, cron el 13-nov → debe expirar (>48 h).
    const booking = makeBooking({
      id: "b-preview",
      precio_total: 91.2,
      created_at: "2026-11-09T10:00:00+00:00",
      fecha_inicio: "2026-12-21",
    });
    const supabase = createMockSupabase({ bookings: [booking] });

    const cutoffIso = cutoffCreatedAtIso(NOW);
    const hoy = todayUtcDateString(NOW);
    const found = await fetchPendientesExpirables(supabase, {
      cutoffIso,
      hoy,
      limit: 50,
    });
    expect(found.map((b) => b.id)).toEqual(["b-preview"]);

    const stats = await runExpirarPendientes({
      supabaseAdmin: supabase,
      stripe: {},
      now: NOW,
      cancelPayment,
      devolverCredito,
      notify,
      sendEmail,
    });
    expect(stats.scanned).toBe(1);
    expect(stats.expired).toBe(1);
    expect(supabase._store.bookings[0].estado).toBe(EXPIRAR_ESTADO);
  });
});

describe("regresión: .or() con ISO sin comillas no encuentra candidatas", () => {
  it("PostgREST corta el valor en el primer ':' dentro de or=()", () => {
    const cutoffIso = cutoffCreatedAtIso(NOW); // 2026-11-11T12:00:00.000Z
    const hoy = todayUtcDateString(NOW);
    const broken = buildBrokenExpirarPendientesOrFilter(cutoffIso, hoy);

    expect(broken).toContain("created_at.lt.2026-11-11T12:");
    expect(postgrestUnquotedOrValueAfterLt(broken, "created_at")).toBe(
      "2026-11-11T12",
    );
  });

  it("el filtro or=() sin comillas no es usable: ISO tiene ':' y '.' reservados", () => {
    const cutoffIso = cutoffCreatedAtIso(NOW);
    const hoy = todayUtcDateString(NOW);
    const broken = buildBrokenExpirarPendientesOrFilter(cutoffIso, hoy);
    const truncated = postgrestUnquotedOrValueAfterLt(broken, "created_at");

    // Docs PostgREST: :, . reservados dentro de or=() → hay que citar el valor.
    expect(cutoffIso).toMatch(/:/);
    expect(cutoffIso).toMatch(/\./);
    expect(broken).not.toMatch(/created_at\.lt\."/);
    expect(truncated).not.toBe(cutoffIso);
    expect(truncated).toBe("2026-11-11T12");

    // Con el valor truncado, una comparación naive falla para la fila real
    // (created_at con offset +00:00 no es < "2026-11-11T12" de forma fiable
    // en el servidor; el filtro roto devolvía 0 candidatas).
    const createdAt = "2026-11-09T10:00:00+00:00";
    expect(createdAt < cutoffIso).toBe(true);
    // El valor truncado pierde la zona/segundos: no es el cutoff que queremos.
    expect(Date.parse(truncated)).toBeNaN();
  });
});

describe("buildCronSummary · expirar-pendientes", () => {
  it("incluye revisadas/expiradas/saltadas/revertidas y marca errores", () => {
    const tasks = {
      actualizar_estados: { status: "ok", result: { iniciadas: 0, completadas: 0, liberadas: 0 } },
      calcular_respuesta: { status: "ok", result: {} },
      email_sequences: { status: "ok", result: { stats: {} } },
      holds_huerfanos: { status: "ok", result: { canceled: 0 } },
      expirar_pendientes: {
        status: "ok",
        result: {
          scanned: 3,
          expired: 1,
          skipped: 1,
          reverted: 1,
          errors: ["b9:stripe down"],
        },
      },
    };

    const summary = buildCronSummary(tasks);
    expect(summary).toContain(
      "expirar-pendientes: 3 revisadas, 1 expiradas, 1 saltadas, 1 revertidas",
    );
    expect(summary).toContain("1 error al expirar: b9:stripe down");
    expect(taskSucceeded(tasks.expirar_pendientes)).toBe(false);
  });

  it("sin errores parciales taskSucceeded es true", () => {
    expect(
      taskSucceeded({
        status: "ok",
        result: { scanned: 0, expired: 0, skipped: 0, reverted: 0, errors: [] },
      }),
    ).toBe(true);
  });
});
