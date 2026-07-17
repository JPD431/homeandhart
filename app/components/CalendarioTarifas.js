"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND } from "@/app/components/brand";
import {
  ChevronIcon,
  MONTH_NAMES,
  RANGE_HIGHLIGHT,
  WEEKDAY_LABELS,
  buildMonthGrid,
  getHoyStr,
  parseDateStr,
  toDateStr,
} from "@/app/components/calendario-shared";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";
const BLOCK_BG = "#fef3c7";
const BLOCK_BORDER = "#f59e0b";
const RESERVA_BG = "#fde8e8";
const RESERVA_BORDER = "#f5c6c6";

function getMonthBounds(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    desde: toDateStr(year, month, 1),
    hasta: toDateStr(year, month, lastDay),
  };
}

function formatPrecio(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function MonthTarifasGrid({
  viewDate,
  hoyStr,
  precioBase,
  tarifasMap,
  ocupadasSet,
  bloqueadasSet,
  selectedDays,
  showPrecios,
  onDayClick,
}) {
  const cells = buildMonthGrid(viewDate);
  const monthLabel = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <div className="min-w-0">
      <p className="mb-3 text-center text-sm font-semibold text-[#1a1a1a]">
        {monthLabel}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#888]">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((dateStr, index) => {
          if (!dateStr) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isPast = dateStr < hoyStr;
          const isReserva = ocupadasSet.has(dateStr);
          const isBloqueo = bloqueadasSet.has(dateStr);
          const isToday = dateStr === hoyStr;
          const isSelected = selectedDays.has(dateStr);
          const customPrecio = tarifasMap[dateStr];
          const hasCustom =
            showPrecios && customPrecio != null && Number(customPrecio) > 0;
          const displayPrecio = hasCustom ? customPrecio : precioBase;

          const clickable = !isPast && !isReserva;

          let bg = "#fff";
          let borderColor = BRAND.border;
          let boxShadow;
          let textDecoration = "none";
          let dayColor = isPast ? "#ccc" : "#1a1a1a";
          let subLabel = null;
          let subColor = "#888";

          if (isReserva) {
            bg = RESERVA_BG;
            borderColor = RESERVA_BORDER;
            textDecoration = "line-through";
            dayColor = "#c0392b";
            subLabel = "Reserva";
            subColor = "#c0392b";
          } else if (isBloqueo) {
            bg = BLOCK_BG;
            borderColor = BLOCK_BORDER;
            dayColor = "#92400e";
            subLabel = "Bloqueado";
            subColor = "#92400e";
          } else if (isPast) {
            bg = "#f5f5f5";
          } else if (isSelected) {
            bg = RANGE_HIGHLIGHT;
            borderColor = PRIMARY;
          }

          if (isToday && clickable) {
            boxShadow = `inset 0 0 0 2px ${PRIMARY}`;
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick(dateStr)}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center transition-colors hover:enabled:bg-[#f7f7f7] disabled:cursor-not-allowed"
              style={{
                backgroundColor: bg,
                borderColor,
                boxShadow,
                opacity: isPast && !isReserva && !isBloqueo ? 0.55 : 1,
              }}
              aria-label={
                isReserva
                  ? `${dateStr}, ocupado por reserva`
                  : isBloqueo
                    ? `${dateStr}, bloqueado por mí`
                    : showPrecios
                      ? `${dateStr}, ${formatPrecio(displayPrecio)} euros`
                      : `${dateStr}, disponible`
              }
              aria-pressed={isSelected || isBloqueo}
            >
              <span
                className="text-xs font-semibold leading-none"
                style={{ color: dayColor, textDecoration }}
              >
                {parseDateStr(dateStr).getDate()}
              </span>
              {subLabel ? (
                <span
                  className="mt-0.5 text-[8px] font-semibold uppercase leading-tight tracking-wide"
                  style={{ color: subColor }}
                >
                  {subLabel}
                </span>
              ) : showPrecios ? (
                <span
                  className="mt-0.5 text-[9px] font-medium leading-tight"
                  style={{
                    color: hasCustom && !isPast ? PRIMARY : "#888",
                  }}
                >
                  {formatPrecio(displayPrecio)}€
                </span>
              ) : (
                <span className="mt-0.5 text-[8px] font-medium leading-tight text-[#aaa]">
                  Libre
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   serviceId: string|null,
 *   precioBase?: number,
 *   unidad?: string,
 *   soloBloqueo?: boolean,
 * }} props
 */
export default function CalendarioTarifas({
  serviceId,
  precioBase,
  unidad,
  soloBloqueo = false,
}) {
  const showPrecios = !soloBloqueo;
  const hoy = useMemo(() => new Date(), []);
  const hoyStr = getHoyStr();
  const minViewMonth = useMemo(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1),
    [hoy],
  );

  const [viewMonth, setViewMonth] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  );
  const [tarifasMap, setTarifasMap] = useState({});
  const [ocupadasSet, setOcupadasSet] = useState(() => new Set());
  const [bloqueadasSet, setBloqueadasSet] = useState(() => new Set());
  const [selectedDays, setSelectedDays] = useState(() => new Set());
  const [modo, setModo] = useState(soloBloqueo ? "bloqueo" : "precios");
  const [precioInput, setPrecioInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canGoPrev = viewMonth.getTime() > minViewMonth.getTime();
  const selectedCount = selectedDays.size;
  const baseLabel = Number(precioBase) || 0;
  const unidadLabel = unidad || "noche";
  const effectiveModo = soloBloqueo ? "bloqueo" : modo;

  const loadMonth = useCallback(async () => {
    if (!serviceId) {
      setTarifasMap({});
      setOcupadasSet(new Set());
      setBloqueadasSet(new Set());
      return;
    }

    const { desde, hasta } = getMonthBounds(viewMonth);
    setLoading(true);
    setErrorMessage("");

    try {
      if (showPrecios) {
        const params = new URLSearchParams({
          service_id: serviceId,
          desde,
          hasta,
        });
        const res = await fetch(`/api/tarifas?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "No se pudieron cargar las tarifas");
        }
        const map = {};
        for (const row of data.tarifas ?? []) {
          const fecha =
            typeof row.fecha === "string" ? row.fecha.slice(0, 10) : row.fecha;
          if (fecha) map[fecha] = Number(row.precio);
        }
        setTarifasMap(map);
        setOcupadasSet(new Set(data.ocupadas ?? []));
        setBloqueadasSet(new Set(data.bloqueadas ?? []));
      } else {
        const params = new URLSearchParams({ desde, hasta });
        const res = await fetch(
          `/api/services/${serviceId}/bloqueos?${params.toString()}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "No se pudo cargar la disponibilidad");
        }
        setTarifasMap({});
        setOcupadasSet(new Set(data.ocupadas ?? []));
        setBloqueadasSet(new Set(data.bloqueadas ?? []));
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al cargar el calendario");
      setTarifasMap({});
      setOcupadasSet(new Set());
      setBloqueadasSet(new Set());
    } finally {
      setLoading(false);
    }
  }, [serviceId, viewMonth, showPrecios]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    setSelectedDays(new Set());
    setSuccessMessage("");
  }, [viewMonth, serviceId, effectiveModo]);

  function shiftMonth(delta) {
    setViewMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      if (delta < 0 && next.getTime() < minViewMonth.getTime()) {
        return prev;
      }
      return next;
    });
  }

  async function toggleBloqueoDia(dateStr) {
    if (dateStr < hoyStr || ocupadasSet.has(dateStr)) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const yaBloqueado = bloqueadasSet.has(dateStr);
    try {
      const res = await fetch(`/api/services/${serviceId}/bloqueos`, {
        method: yaBloqueado ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: dateStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el bloqueo");
      }
      await loadMonth();
      setSuccessMessage(
        yaBloqueado ? "Fecha desbloqueada" : "Fecha bloqueada",
      );
    } catch (err) {
      setErrorMessage(err.message || "Error al actualizar el bloqueo");
    } finally {
      setSaving(false);
    }
  }

  function handleDayClick(dateStr) {
    if (dateStr < hoyStr || ocupadasSet.has(dateStr)) return;

    if (effectiveModo === "bloqueo" || bloqueadasSet.has(dateStr)) {
      // En modo bloqueo, o clic en un día ya bloqueado → toggle bloqueo
      toggleBloqueoDia(dateStr);
      return;
    }

    // Modo precios: selección múltiple (no se puede seleccionar un bloqueado)
    if (bloqueadasSet.has(dateStr)) return;
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleAplicar() {
    const precio = Number(precioInput);
    if (selectedCount === 0) return;
    if (!Number.isFinite(precio) || precio <= 0) {
      setErrorMessage("Introduce un precio mayor que 0");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/tarifas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          tarifas: [...selectedDays].map((fecha) => ({ fecha, precio })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron guardar las tarifas");
      }

      await loadMonth();
      setSelectedDays(new Set());
      setPrecioInput("");
      setSuccessMessage("Precios actualizados");
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestablecer() {
    if (selectedCount === 0) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/tarifas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          fechas: [...selectedDays],
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron restablecer las tarifas");
      }

      await loadMonth();
      setSelectedDays(new Set());
      setSuccessMessage("Precios actualizados");
    } catch (err) {
      setErrorMessage(err.message || "Error al restablecer");
    } finally {
      setSaving(false);
    }
  }

  async function handleBloquearSeleccion() {
    if (selectedCount === 0) return;
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await fetch(`/api/services/${serviceId}/bloqueos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechas: [...selectedDays] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron bloquear las fechas");
      }
      await loadMonth();
      setSelectedDays(new Set());
      setSuccessMessage("Fechas bloqueadas");
    } catch (err) {
      setErrorMessage(err.message || "Error al bloquear");
    } finally {
      setSaving(false);
    }
  }

  if (!serviceId) {
    return (
      <p className="text-sm text-[#888]">
        Guarda el servicio antes de configurar el calendario.
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border bg-white p-4 sm:p-5"
      style={{ borderColor: BRAND.border }}
    >
      {showPrecios ? (
        <p className="text-xs leading-relaxed text-[#666]">
          Los días sin precio personalizado usan tu precio base de{" "}
          <span className="font-semibold text-[#1a1a1a]">
            {formatPrecio(baseLabel)}€/{unidadLabel}
          </span>
          . También puedes bloquear días en los que no estás disponible.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-[#666]">
          Marca los días en los que no estás disponible. Las familias no podrán
          reservarlos. Pulsa de nuevo un día bloqueado para liberarlo.
        </p>
      )}

      {showPrecios && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModo("precios")}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: effectiveModo === "precios" ? PRIMARY : BRAND.border,
              backgroundColor: effectiveModo === "precios" ? "#e8f0fb" : "#fff",
              color: effectiveModo === "precios" ? PRIMARY : "#666",
            }}
          >
            Poner precios
          </button>
          <button
            type="button"
            onClick={() => setModo("bloqueo")}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: effectiveModo === "bloqueo" ? BLOCK_BORDER : BRAND.border,
              backgroundColor:
                effectiveModo === "bloqueo" ? BLOCK_BG : "#fff",
              color: effectiveModo === "bloqueo" ? "#92400e" : "#666",
            }}
          >
            Bloquear fechas
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#666]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border"
            style={{ backgroundColor: "#fff", borderColor: BRAND.border }}
          />
          Disponible
        </span>
        {showPrecios && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded border"
              style={{ backgroundColor: RANGE_HIGHLIGHT, borderColor: PRIMARY }}
            />
            Precio especial
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border"
            style={{ backgroundColor: BLOCK_BG, borderColor: BLOCK_BORDER }}
          />
          Bloqueado por mí
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border"
            style={{ backgroundColor: RESERVA_BG, borderColor: RESERVA_BORDER }}
          />
          Ocupado por reserva
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoPrev || loading || saving}
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: BRAND.border, color: PRIMARY }}
          aria-label="Mes anterior"
        >
          <ChevronIcon direction="left" />
        </button>
        <span className="text-xs text-[#888]">
          {loading
            ? "Cargando…"
            : effectiveModo === "bloqueo"
              ? "Pulsa un día para bloquear o desbloquear"
              : "Selecciona días y asigna un precio"}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={loading || saving}
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: BRAND.border, color: PRIMARY }}
          aria-label="Mes siguiente"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className={`mt-4 ${loading ? "opacity-60" : ""}`}>
        <MonthTarifasGrid
          viewDate={viewMonth}
          hoyStr={hoyStr}
          precioBase={baseLabel}
          tarifasMap={tarifasMap}
          ocupadasSet={ocupadasSet}
          bloqueadasSet={bloqueadasSet}
          selectedDays={selectedDays}
          showPrecios={showPrecios}
          onDayClick={handleDayClick}
        />
      </div>

      {effectiveModo === "precios" && showPrecios && (
        <div
          className="mt-5 rounded-lg border p-4"
          style={{ borderColor: BRAND.border, backgroundColor: "#faf9f7" }}
        >
          <p className="mb-3 text-xs font-medium text-[#444]">
            {selectedCount === 0
              ? "Selecciona uno o más días en el calendario"
              : `${selectedCount} día${selectedCount > 1 ? "s" : ""} seleccionado${selectedCount > 1 ? "s" : ""}`}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="calendario-tarifas-precio"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Precio (€)
              </label>
              <input
                id="calendario-tarifas-precio"
                type="number"
                min="0"
                step="0.01"
                value={precioInput}
                onChange={(e) => setPrecioInput(e.target.value)}
                placeholder={String(baseLabel || "")}
                disabled={saving}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <button
              type="button"
              onClick={handleAplicar}
              disabled={selectedCount === 0 || saving}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving
                ? "Guardando…"
                : `Aplicar a ${selectedCount} día${selectedCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={handleRestablecer}
              disabled={selectedCount === 0 || saving}
              className="shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: GREEN, color: GREEN }}
            >
              Restablecer al precio base
            </button>
            <button
              type="button"
              onClick={handleBloquearSeleccion}
              disabled={selectedCount === 0 || saving}
              className="shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: BLOCK_BORDER, color: "#92400e" }}
            >
              Bloquear seleccionados
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <p className="mt-3 text-xs font-medium" style={{ color: GREEN }}>
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="mt-3 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
