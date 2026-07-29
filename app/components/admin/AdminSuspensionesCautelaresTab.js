"use client";

import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";
import { SUSPENSION_CAUTELAR_POR_SISTEMA } from "@/app/lib/report-severity";

const GREEN = "#085041";
const AMBER = "#92400e";
const RED = "#b91c1c";

function fullName(p) {
  return [p?.nombre, p?.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFechaReserva(b) {
  if (!b?.fecha_inicio) return "—";
  if (b.hora) return `${b.fecha_inicio} · ${b.hora}`;
  if (b.fecha_fin && b.fecha_fin !== b.fecha_inicio) {
    return `${b.fecha_inicio} – ${b.fecha_fin}`;
  }
  return b.fecha_inicio;
}

function labelPor(por) {
  if (!por) return "—";
  if (por === SUSPENSION_CAUTELAR_POR_SISTEMA) return "sistema (reporte automático)";
  return `admin (${por.slice(0, 8)}…)`;
}

/**
 * @param {Object} props
 * @param {(msg: string) => void} [props.onSuccess]
 * @param {(msg: string) => void} [props.onError]
 * @param {(count: number) => void} [props.onMeta]
 */
export default function AdminSuspensionesCautelaresTab({
  onSuccess,
  onError,
  onMeta,
}) {
  const [loading, setLoading] = useState(true);
  const [suspensiones, setSuspensiones] = useState([]);
  const [huerfanas, setHuerfanas] = useState([]);
  const [meta, setMeta] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [manualId, setManualId] = useState("");
  const [manualMotivo, setManualMotivo] = useState("");
  const [expulsarMotivo, setExpulsarMotivo] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/suspensiones-cautelares");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Error al cargar suspensiones");
      }
      setSuspensiones(payload.suspensiones ?? []);
      setHuerfanas(payload.reservas_huerfanas ?? []);
      setMeta(payload.meta ?? null);
      onMeta?.(payload.meta?.total_suspendidos ?? 0);
    } catch (err) {
      onError?.(err.message || "Error al cargar suspensiones");
      setSuspensiones([]);
      setHuerfanas([]);
      onMeta?.(0);
    } finally {
      setLoading(false);
    }
  }, [onError, onMeta]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLevantar(providerId) {
    if (
      !window.confirm(
        "¿Levantar la suspensión cautelar? El proveedor podrá reactivar servicios si cumple el resto de requisitos (no se reactivan solos).",
      )
    ) {
      return;
    }

    setBusyKey(`levantar-${providerId}`);
    onError?.("");
    try {
      const res = await fetch(
        `/api/admin/providers/${providerId}/levantar-suspension-cautelar`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "No se pudo levantar la suspensión");
      }
      onSuccess?.(
        payload.already_clear
          ? "La suspensión ya estaba levantada."
          : "Suspensión levantada. El proveedor puede reactivar servicios si pasa los gates.",
      );
      await load();
    } catch (err) {
      onError?.(err.message || "Error al levantar");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExpulsar(providerId) {
    if (
      !window.confirm(
        "¿Confirmar y expulsar? Se mantendrá la suspensión y se rechazará la cuenta del proveedor (no podrá operar).",
      )
    ) {
      return;
    }

    setBusyKey(`expulsar-${providerId}`);
    onError?.("");
    try {
      const res = await fetch(
        `/api/admin/providers/${providerId}/expulsar-suspension-cautelar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            motivo: expulsarMotivo[providerId]?.trim() || undefined,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "No se pudo expulsar");
      }
      onSuccess?.(
        "Proveedor expulsado: cuenta rechazada y suspensión cautelar mantenida.",
      );
      await load();
    } catch (err) {
      onError?.(err.message || "Error al expulsar");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleManualSuspend(e) {
    e.preventDefault();
    const id = manualId.trim();
    const motivo = manualMotivo.trim();
    if (!id || motivo.length < 5) {
      onError?.("Indica el ID del proveedor y un motivo (mín. 5 caracteres).");
      return;
    }
    if (
      !window.confirm(
        "¿Suspender cautelarmente a este proveedor? Se pausarán todos sus servicios.",
      )
    ) {
      return;
    }

    setBusyKey("manual");
    onError?.("");
    try {
      const res = await fetch(
        `/api/admin/providers/${id}/suspender-cautelar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "No se pudo suspender");
      }
      onSuccess?.(
        payload.already_suspended
          ? "El proveedor ya estaba suspendido."
          : `Suspensión aplicada. Servicios pausados: ${payload.servicios_pausados ?? 0}. Reservas marcadas: ${payload.reservas_marcadas ?? 0}.`,
      );
      setManualId("");
      setManualMotivo("");
      await load();
    } catch (err) {
      onError?.(err.message || "Error al suspender");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReservaAccion(bookingId, accion) {
    if (accion === "cancelar") {
      if (
        !window.confirm(
          "¿Cancelar esta reserva con reembolso total al cliente? Se usa el flujo de reembolso de incidencias.",
        )
      ) {
        return;
      }
    }

    setBusyKey(`booking-${bookingId}-${accion}`);
    onError?.("");
    try {
      const res = await fetch(
        `/api/admin/bookings/${bookingId}/revision-seguridad`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion,
            nota:
              accion === "cancelar"
                ? "Cancelación admin · revisión seguridad"
                : undefined,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "No se pudo actualizar la reserva");
      }
      onSuccess?.(
        accion === "marcar_revisada"
          ? "Reserva marcada como revisada."
          : payload.skipped_refund
            ? payload.message || "Flag quitado (reserva ya no activa)."
            : "Reserva cancelada con reembolso al cliente.",
      );
      await load();
    } catch (err) {
      onError?.(err.message || "Error en la reserva");
    } finally {
      setBusyKey(null);
    }
  }

  function renderReservas(list) {
    if (!list?.length) {
      return (
        <p className="mt-2 text-xs text-[#888]">
          Sin reservas marcadas para revisión de seguridad.
        </p>
      );
    }

    return (
      <ul className="mt-2 flex flex-col gap-2">
        {list.map((b) => {
          const busyRev = busyKey === `booking-${b.id}-marcar_revisada`;
          const busyCancel = busyKey === `booking-${b.id}-cancelar`;
          return (
            <li
              key={b.id}
              className="rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[#1a1a1a]">
                    {b.servicio_titulo}
                    {b.vertical ? ` · ${b.vertical}` : ""}
                  </p>
                  <p className="text-xs text-[#666]">
                    {formatFechaReserva(b)} · estado: {b.estado}
                    {b.precio_total != null
                      ? ` · ${Number(b.precio_total).toFixed(2)}€`
                      : ""}
                  </p>
                  <p className="font-mono text-[10px] text-[#aaa]">{b.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => handleReservaAccion(b.id, "marcar_revisada")}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: BRAND.border, color: "#444" }}
                  >
                    {busyRev ? "…" : "Marcar revisada"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => handleReservaAccion(b.id, "cancelar")}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: RED }}
                  >
                    {busyCancel ? "…" : "Cancelar + reembolsar"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mt-6">
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: "#fecaca",
          backgroundColor: "#fef2f2",
          color: RED,
        }}
      >
        <strong>
          {meta?.total_suspendidos ?? 0} suspensión(es) cautelar(es)
        </strong>
        {meta?.total_reservas_revision != null && (
          <span>
            {" "}
            · {meta.total_reservas_revision} reserva(s) con revisión de
            seguridad pendiente
          </span>
        )}
        <p className="mt-1 text-xs text-[#666]">
          Las reservas confirmadas no se cancelan solas: revísalas abajo. Levantar
          no reactiva anuncios; expulsar = rechazar cuenta + mantener suspensión
          (sin columna «baneado» nueva).
        </p>
      </div>

      <form
        onSubmit={handleManualSuspend}
        className="mt-5 rounded-2xl border bg-white p-5"
        style={{ borderColor: BRAND.border }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
          Suspender manualmente
        </p>
        <p className="mt-1 text-xs text-[#666]">
          Si detectas un riesgo sin reporte formal: pausa todos los servicios y
          marca reservas activas.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-[#444]">
              ID del proveedor (uuid)
            </label>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="uuid del perfil"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div className="flex-[2]">
            <label className="text-xs font-medium text-[#444]">Motivo</label>
            <input
              value={manualMotivo}
              onChange={(e) => setManualMotivo(e.target.value)}
              placeholder="Motivo de la suspensión manual…"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <button
            type="submit"
            disabled={busyKey === "manual"}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: AMBER }}
          >
            {busyKey === "manual" ? "…" : "Suspender"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#888]">Cargando…</p>
      ) : suspensiones.length === 0 ? (
        <p
          className="mt-6 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
          style={{ borderColor: BRAND.border }}
        >
          No hay proveedores en suspensión cautelar.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5">
          {suspensiones.map((p) => {
            const busyLevantar = busyKey === `levantar-${p.id}`;
            const busyExpulsar = busyKey === `expulsar-${p.id}`;
            return (
              <li
                key={p.id}
                className="rounded-2xl border bg-white p-5 sm:p-6"
                style={{ borderColor: "#fecaca" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">
                      {fullName(p)}
                    </h2>
                    <p className="text-sm text-[#666]">{p.email || "—"}</p>
                    <p className="mt-1 font-mono text-[10px] text-[#aaa]">
                      {p.id}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: "#fef2f2", color: RED }}
                      >
                        Suspensión cautelar
                      </span>
                      {p.rechazado && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: "#f3f4f6", color: "#444" }}
                        >
                          Cuenta rechazada / expulsada
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#888]">
                    Desde {formatDate(p.suspendido_cautelar_at)}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                      Motivo
                    </p>
                    <p className="mt-1 text-[#1a1a1a]">
                      {p.suspendido_cautelar_motivo || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                      Disparado por
                    </p>
                    <p className="mt-1 text-[#1a1a1a]">
                      {labelPor(p.suspendido_cautelar_por)}
                    </p>
                  </div>
                </div>

                {p.reporte && (
                  <div
                    className="mt-4 rounded-xl border px-3 py-2.5 text-sm"
                    style={{ borderColor: BRAND.border, backgroundColor: "#fafafa" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                      Reporte origen
                    </p>
                    <p className="mt-1 font-medium text-[#1a1a1a]">
                      {p.reporte.motivo}
                      <span className="ml-2 text-xs font-normal text-[#888]">
                        · {p.reporte.estado} · {formatDate(p.reporte.created_at)}
                      </span>
                    </p>
                    {p.reporte.descripcion && (
                      <p className="mt-1 text-xs leading-relaxed text-[#555]">
                        {p.reporte.descripcion}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-[#aaa]">
                      report_id: {p.reporte.id}
                      {p.reporte.booking_id
                        ? ` · booking: ${p.reporte.booking_id}`
                        : ""}
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Reservas a revisión
                  </p>
                  {renderReservas(p.reservas_revision)}
                </div>

                <div className="mt-5 border-t pt-4" style={{ borderColor: BRAND.border }}>
                  <label className="text-xs font-medium text-[#444]">
                    Motivo adicional al expulsar (opcional)
                  </label>
                  <input
                    value={expulsarMotivo[p.id] || ""}
                    onChange={(e) =>
                      setExpulsarMotivo((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    placeholder="Se guarda como motivo de rechazo…"
                    className="mt-1 w-full max-w-xl rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                    style={{ borderColor: BRAND.border }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busyKey || p.rechazado}
                      onClick={() => handleLevantar(p.id)}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: GREEN }}
                      title={
                        p.rechazado
                          ? "Cuenta ya expulsada/rechazada"
                          : "Levantar suspensión"
                      }
                    >
                      {busyLevantar ? "…" : "Levantar suspensión"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busyKey}
                      onClick={() => handleExpulsar(p.id)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busyExpulsar
                        ? "…"
                        : p.rechazado
                          ? "Re-confirmar expulsión"
                          : "Confirmar / expulsar"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {huerfanas.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
            Reservas a revisión (proveedor ya no suspendido o sin match)
          </p>
          {renderReservas(huerfanas)}
        </div>
      )}
    </div>
  );
}
