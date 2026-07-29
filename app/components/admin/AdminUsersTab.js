"use client";

import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";

const GREEN = "#085041";
const AMBER = "#92400e";
const RED = "#b91c1c";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "pendiente", label: "DNI pendiente" },
  { id: "sin_dni", label: "Sin DNI" },
  { id: "verificado", label: "Verificados" },
  { id: "rechazado", label: "Rechazados" },
];

function fullName(user) {
  return [user.nombre, user.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dniEstadoBadge(estado, subido) {
  if (!subido) {
    return { label: "Falta documento", bg: "#f3f4f6", color: "#666" };
  }
  switch (estado) {
    case "verificado":
      return { label: "Verificado", bg: "#e6f4f0", color: GREEN };
    case "rechazado":
      return { label: "Rechazado", bg: "#fef2f2", color: RED };
    default:
      return { label: "Pendiente revisión", bg: "#fdf4e7", color: AMBER };
  }
}

function rolBadgeStyle(rolLabel) {
  if (rolLabel === "Cliente + Proveedor") {
    return { bg: "#e8f0fb", color: "#163a6b" };
  }
  if (rolLabel === "Proveedor") {
    return { bg: "#fdf4e7", color: AMBER };
  }
  return { bg: "#f3f4f6", color: "#444" };
}

/**
 * @param {Object} props
 * @param {(msg: string) => void} [props.onSuccess]
 * @param {(msg: string) => void} [props.onError]
 */
export default function AdminUsersTab({ onSuccess, onError }) {
  const [usuarios, setUsuarios] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [actionUserId, setActionUserId] = useState(null);
  const [openingUserId, setOpeningUserId] = useState(null);
  /** @type {[Record<string, boolean>, Function]} */
  const [edadCheckedByUser, setEdadCheckedByUser] = useState({});

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filtro });
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/usuarios?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "Error al cargar usuarios");
      }

      setUsuarios(payload.usuarios ?? []);
      setMeta(payload.meta ?? null);
    } catch (err) {
      onError?.(err.message || "Error al cargar usuarios");
      setUsuarios([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [filtro, search, onError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsuarios();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadUsuarios, search]);

  function toggleEdadCheck(userId) {
    setEdadCheckedByUser((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  }

  async function handleOpenDni(user) {
    if (!user.doc_dni_url) return;
    setOpeningUserId(user.id);
    onError?.("");

    try {
      const res = await fetch(
        `/api/admin/documento-url?storedUrl=${encodeURIComponent(user.doc_dni_url)}`,
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "No se pudo abrir el documento");
      }

      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      onError?.(err.message || "No se pudo abrir el DNI");
    } finally {
      setOpeningUserId(null);
    }
  }

  async function handleDniEstado(userId, estado) {
    if (estado === "verificado" && !edadCheckedByUser[userId]) {
      onError?.(
        "Marca el checkbox «He verificado que es mayor de edad (18+) según el DNI» antes de verificar.",
      );
      return;
    }

    setActionUserId(userId);
    onError?.("");

    try {
      const body = { userId, estado };
      if (estado === "verificado") {
        body.confirmar_mayor_de_edad = true;
      }

      const res = await fetch("/api/admin/usuarios/dni-estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "No se pudo actualizar el estado del DNI");
      }

      onSuccess?.(
        estado === "verificado"
          ? "DNI verificado y mayoría de edad (18+) confirmada."
          : "DNI marcado como rechazado.",
      );
      setEdadCheckedByUser((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await loadUsuarios();
    } catch (err) {
      onError?.(err.message || "Error al actualizar el DNI");
    } finally {
      setActionUserId(null);
    }
  }

  async function handleConfirmarMayorDeEdad(userId) {
    if (!edadCheckedByUser[userId]) {
      onError?.(
        "Abre el DNI, comprueba la fecha de nacimiento y marca el checkbox de mayoría de edad.",
      );
      return;
    }

    setActionUserId(userId);
    onError?.("");

    try {
      const res = await fetch("/api/admin/usuarios/confirmar-mayor-de-edad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "No se pudo confirmar la mayoría de edad");
      }

      onSuccess?.(
        payload.already_confirmed
          ? "La mayoría de edad ya estaba confirmada."
          : "Mayoría de edad (18+) confirmada.",
      );
      setEdadCheckedByUser((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await loadUsuarios();
    } catch (err) {
      onError?.(err.message || "Error al confirmar la mayoría de edad");
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label
            htmlFor="admin-users-search"
            className="text-xs font-semibold uppercase tracking-wide text-[#888]"
          >
            Buscar por nombre o email
          </label>
          <input
            id="admin-users-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, apellido o email…"
            className="mt-1 w-full max-w-md rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
            style={{ borderColor: BRAND.border }}
          />
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
              </button>
            );
          })}
        </div>
      </div>

      {meta && (
        <p className="mt-3 text-xs text-[#888]">
          Mostrando hasta {meta.limit} usuarios
          {meta.pendientes > 0 && filtro === "todos"
            ? ` · ${meta.pendientes} con DNI pendiente de revisión`
            : ""}
          {meta.sin_dni > 0 && filtro === "todos"
            ? ` · ${meta.sin_dni} sin DNI`
            : ""}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#888]">Cargando usuarios…</p>
      ) : usuarios.length === 0 ? (
        <p
          className="mt-8 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
          style={{ borderColor: BRAND.border }}
        >
          No hay usuarios que coincidan con la búsqueda o el filtro.
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
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Cancelaciones</th>
                <th className="px-4 py-3">DNI / 18+</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((user) => {
                const estadoBadge = dniEstadoBadge(user.dni_estado, user.dni_subido);
                const rolStyle = rolBadgeStyle(user.rol_label);
                const busy = actionUserId === user.id;
                const opening = openingUserId === user.id;
                const edadChecked = !!edadCheckedByUser[user.id];
                const needsVerify =
                  user.dni_subido && user.dni_estado !== "verificado";
                const needsLegacyAge =
                  user.dni_subido &&
                  user.dni_estado === "verificado" &&
                  user.mayor_de_edad_confirmada !== true;
                const showAgeCheckbox = needsVerify || needsLegacyAge;

                return (
                  <tr
                    key={user.id}
                    className="border-b last:border-b-0 align-top"
                    style={{ borderColor: BRAND.border }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a1a1a]">{fullName(user)}</p>
                      <p className="text-xs text-[#888]">{user.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: rolStyle.bg,
                          color: rolStyle.color,
                        }}
                      >
                        {user.rol_label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color:
                            (user.cancelaciones_count || 0) > 0 ? AMBER : "#666",
                        }}
                      >
                        {user.cancelaciones_count || 0}
                      </span>
                      <p className="text-[10px] text-[#aaa]">no exentas</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {user.dni_subido ? (
                          <span className="text-xs font-medium" style={{ color: GREEN }}>
                            DNI subido ✓
                          </span>
                        ) : (
                          <span className="text-xs font-medium" style={{ color: AMBER }}>
                            DNI falta ⚠
                          </span>
                        )}
                        <span
                          className="inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: estadoBadge.bg,
                            color: estadoBadge.color,
                          }}
                        >
                          {estadoBadge.label}
                        </span>
                        {user.dni_subido && (
                          <span
                            className="inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: user.mayor_de_edad_confirmada
                                ? "#e6f4f0"
                                : "#fdf4e7",
                              color: user.mayor_de_edad_confirmada ? GREEN : AMBER,
                            }}
                          >
                            {user.mayor_de_edad_confirmada
                              ? "18+ confirmada"
                              : "18+ pendiente"}
                          </span>
                        )}
                        {user.dni_estado === "verificado" && user.dni_verificado_at && (
                          <p className="text-[10px] text-[#888]">
                            {formatDate(user.dni_verificado_at)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#666]">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {showAgeCheckbox && (
                          <label className="flex max-w-[260px] cursor-pointer items-start gap-2 text-left text-[11px] leading-snug text-[#444]">
                            <input
                              type="checkbox"
                              checked={edadChecked}
                              onChange={() => toggleEdadCheck(user.id)}
                              className="mt-0.5 accent-[#085041]"
                            />
                            <span>
                              He verificado que es mayor de edad (18+) según el DNI
                            </span>
                          </label>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          {user.dni_subido && (
                            <button
                              type="button"
                              disabled={opening || busy}
                              onClick={() => handleOpenDni(user)}
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                              style={{
                                borderColor: BRAND.primary,
                                color: BRAND.primary,
                              }}
                            >
                              {opening ? "Abriendo…" : "Ver DNI"}
                            </button>
                          )}
                          {needsVerify && (
                            <button
                              type="button"
                              disabled={busy || opening || !edadChecked}
                              title={
                                edadChecked
                                  ? "Verificar DNI y confirmar 18+"
                                  : "Marca el checkbox de mayoría de edad primero"
                              }
                              onClick={() => handleDniEstado(user.id, "verificado")}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ backgroundColor: GREEN }}
                            >
                              {busy ? "…" : "Verificar DNI"}
                            </button>
                          )}
                          {needsLegacyAge && (
                            <button
                              type="button"
                              disabled={busy || opening || !edadChecked}
                              title={
                                edadChecked
                                  ? "Confirmar mayoría de edad"
                                  : "Marca el checkbox tras abrir el DNI"
                              }
                              onClick={() => handleConfirmarMayorDeEdad(user.id)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ backgroundColor: GREEN }}
                            >
                              {busy ? "…" : "Confirmar 18+"}
                            </button>
                          )}
                          {user.dni_subido && user.dni_estado !== "rechazado" && (
                            <button
                              type="button"
                              disabled={busy || opening}
                              onClick={() => handleDniEstado(user.id, "rechazado")}
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                              style={{ borderColor: RED, color: RED }}
                            >
                              {busy ? "…" : "Rechazar DNI"}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-[#888]">
        Flujo: abre el DNI → comprueba la fecha de nacimiento → marca el checkbox
        18+ → Verificar DNI. La verificación del DNI es independiente de la
        aprobación del proveedor (pestañas Pendientes / Verificados).
      </p>
    </div>
  );
}
