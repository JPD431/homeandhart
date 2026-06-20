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
  selectedDays,
  onToggleDay,
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
          const isToday = dateStr === hoyStr;
          const isSelected = selectedDays.has(dateStr);
          const customPrecio = tarifasMap[dateStr];
          const hasCustom =
            customPrecio != null && Number(customPrecio) > 0;
          const displayPrecio = hasCustom ? customPrecio : precioBase;
          const selectable = !isPast;

          let bg = "#fff";
          let borderColor = BRAND.border;
          let boxShadow;

          if (isPast) {
            bg = "#f5f5f5";
          } else if (isSelected) {
            bg = RANGE_HIGHLIGHT;
            borderColor = PRIMARY;
          }

          if (isToday && !isPast) {
            boxShadow = `inset 0 0 0 2px ${PRIMARY}`;
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onToggleDay(dateStr)}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center transition-colors hover:enabled:bg-[#f7f7f7] disabled:cursor-not-allowed"
              style={{
                backgroundColor: bg,
                borderColor,
                boxShadow,
                opacity: isPast ? 0.55 : 1,
              }}
              aria-label={`${dateStr}, ${formatPrecio(displayPrecio)} euros`}
              aria-pressed={isSelected}
            >
              <span
                className="text-xs font-semibold leading-none"
                style={{ color: isPast ? "#ccc" : "#1a1a1a" }}
              >
                {parseDateStr(dateStr).getDate()}
              </span>
              <span
                className="mt-0.5 text-[9px] font-medium leading-tight"
                style={{
                  color: hasCustom && !isPast ? PRIMARY : "#888",
                }}
              >
                {formatPrecio(displayPrecio)}€
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarioTarifas({ serviceId, precioBase, unidad }) {
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
  const [selectedDays, setSelectedDays] = useState(() => new Set());
  const [precioInput, setPrecioInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canGoPrev = viewMonth.getTime() > minViewMonth.getTime();
  const selectedCount = selectedDays.size;
  const baseLabel = Number(precioBase) || 0;
  const unidadLabel = unidad || "noche";

  const loadTarifas = useCallback(async () => {
    if (!serviceId) {
      setTarifasMap({});
      return;
    }

    const { desde, hasta } = getMonthBounds(viewMonth);
    setLoading(true);
    setErrorMessage("");

    try {
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
    } catch (err) {
      setErrorMessage(err.message || "Error al cargar las tarifas");
      setTarifasMap({});
    } finally {
      setLoading(false);
    }
  }, [serviceId, viewMonth]);

  useEffect(() => {
    loadTarifas();
  }, [loadTarifas]);

  useEffect(() => {
    setSelectedDays(new Set());
    setSuccessMessage("");
  }, [viewMonth, serviceId]);

  function shiftMonth(delta) {
    setViewMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      if (delta < 0 && next.getTime() < minViewMonth.getTime()) {
        return prev;
      }
      return next;
    });
  }

  function toggleDay(dateStr) {
    if (dateStr < hoyStr) return;
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

      await loadTarifas();
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

      await loadTarifas();
      setSelectedDays(new Set());
      setSuccessMessage("Precios actualizados");
    } catch (err) {
      setErrorMessage(err.message || "Error al restablecer");
    } finally {
      setSaving(false);
    }
  }

  if (!serviceId) {
    return (
      <p className="text-sm text-[#888]">
        Guarda el servicio antes de configurar precios por fecha.
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border bg-white p-4 sm:p-5"
      style={{ borderColor: BRAND.border }}
    >
      <p className="text-xs leading-relaxed text-[#666]">
        Los días sin precio personalizado usan tu precio base de{" "}
        <span className="font-semibold text-[#1a1a1a]">
          {formatPrecio(baseLabel)}€/{unidadLabel}
        </span>
        .
      </p>

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
          {loading ? "Cargando tarifas…" : "Selecciona días y asigna un precio"}
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
          selectedDays={selectedDays}
          onToggleDay={toggleDay}
        />
      </div>

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
              : `Aplicar a ${selectedCount} día${selectedCount === 1 ? "" : "s"} seleccionado${selectedCount === 1 ? "" : "s"}`}
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
        </div>

        {successMessage && (
          <p className="mt-3 text-xs font-medium" style={{ color: GREEN }}>
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-3 text-xs text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
