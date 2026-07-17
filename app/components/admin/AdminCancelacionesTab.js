"use client";

import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";

const GREEN = "#085041";
const AMBER = "#92400e";
const RED = "#b91c1c";

const FILTROS = [
  { id: "activas", label: "Cuentan (no exentas)" },
  { id: "exentas", label: "Exentas (fuerza mayor)" },
  { id: "todas", label: "Todas" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFechas(inicio, fin) {
  if (!inicio) return "—";
  if (fin && fin !== inicio) return `${inicio} – ${fin}`;
  return inicio;
}

/**
 * @param {Object} props
 * @param {(msg: string) => void} [props.onSuccess]
 * @param {(msg: string) => void} [props.onError]
 */
export default function AdminCancelacionesTab({ onSuccess, onError }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("activas");
  const [busyId, setBusyId] = useState(null);
  const [notaById, setNotaById] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/cancelaciones?filtro=${encodeURIComponent(filtro)}`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Error al cargar cancelaciones");
      }
      setRows(payload.cancelaciones ?? []);
      setMeta(payload.meta ?? null);
    } catch (err) {
      onError?.(err.message || "Error al cargar cancelaciones");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filtro, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleEximir(row) {
    const confirmMsg = `¿Marcar como fuerza mayor / exenta la cancelación de ${row.usuario_nombre}? Dejará de contar en su contador.`;
    if (!window.confirm(confirmMsg)) return;

    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/cancelaciones/eximir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancelacionId: row.id,
          nota: notaById[row.id] || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "No se pudo eximir");
      }
      onSuccess?.(
        payload.already_exenta
          ? "Ya estaba exenta."
          : "Cancelación marcada como fuerza mayor (exenta).",
      );
      await load();
    } catch (err) {
      onError?.(err.message || "Error al eximir");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Cancelaciones</h2>
          <p className="mt-1 text-xs text-[#888]">
            Registro interno. Eximir = fuerza mayor (no cuenta para el usuario).
            No cambia reembolsos ni garantía ya aplicados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const active = filtro === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  borderColor: active ? BRAND.primary : BRAND.border,
                  backgroundColor: active ? BRAND.light : "#fff",
                  color: active ? BRAND.primary : "#666",
                }}
              >
                {f.label}
                {meta && f.id === "activas" ? ` (${meta.activas})` : ""}
                {meta && f.id === "exentas" ? ` (${meta.exentas})` : ""}
                {meta && f.id === "todas" ? ` (${meta.total})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#888]">Cargando…</p>
      ) : rows.length === 0 ? (
        <p
          className="mt-8 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
          style={{ borderColor: BRAND.border }}
        >
          No hay cancelaciones en este filtro.
        </p>
      ) : (
        <div
          className="mt-4 overflow-x-auto rounded-2xl border bg-white"
          style={{ borderColor: BRAND.border }}
        >
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr
                className="border-b text-xs font-semibold uppercase tracking-wide text-[#888]"
                style={{ borderColor: BRAND.border }}
              >
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Quién canceló</th>
                <th className="px-4 py-3">Reserva</th>
                <th className="px-4 py-3">Motivo / contexto</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr
                    key={row.id}
                    className="border-b last:border-b-0 align-top"
                    style={{ borderColor: BRAND.border }}
                  >
                    <td className="px-4 py-3 text-[#666]">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a1a1a]">
                        {row.usuario_nombre}
                      </p>
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor:
                            row.rol_cancelador === "proveedor"
                              ? "#fdf4e7"
                              : "#e8f0fb",
                          color:
                            row.rol_cancelador === "proveedor"
                              ? AMBER
                              : "#163a6b",
                        }}
                      >
                        {row.rol_cancelador === "proveedor"
                          ? "Proveedor"
                          : "Cliente"}
                      </span>
                      {row.exenta && (
                        <p className="mt-1 text-[10px] font-semibold" style={{ color: GREEN }}>
                          Exenta · fuerza mayor
                          {row.exenta_at ? ` · ${formatDate(row.exenta_at)}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a1a1a]">
                        {row.servicio_titulo || "Servicio"}
                      </p>
                      <p className="text-xs text-[#888]">
                        {formatFechas(row.fecha_inicio, row.fecha_fin)}
                        {row.booking_estado ? ` · ${row.booking_estado}` : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#aaa]">
                        {row.booking_id?.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs leading-relaxed text-[#666]">
                        {row.motivo || "Sin motivo indicado al cancelar"}
                      </p>
                      {row.nota_admin && (
                        <p className="mt-1 text-[11px] text-[#888]">
                          Nota admin: {row.nota_admin}
                        </p>
                      )}
                      {!row.exenta && (
                        <input
                          type="text"
                          placeholder="Nota al eximir (opcional)"
                          value={notaById[row.id] || ""}
                          onChange={(e) =>
                            setNotaById((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-lg border px-2 py-1.5 text-xs"
                          style={{ borderColor: BRAND.border }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!row.exenta ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleEximir(row)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: GREEN }}
                        >
                          {busy ? "…" : "Eximir (fuerza mayor)"}
                        </button>
                      ) : (
                        <span className="text-xs font-medium" style={{ color: GREEN }}>
                          Ya exenta
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
