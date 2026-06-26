"use client";

import { useMemo, useState } from "react";
import { BRAND } from "@/app/components/brand";
import {
  ChevronIcon,
  MONTH_NAMES,
  RANGE_HIGHLIGHT,
  WEEKDAY_LABELS,
  buildMonthGrid,
  getHoyStr,
  handleRangeDayClick,
  isInRange,
  parseDateStr,
} from "@/app/components/calendario-shared";

function isDateOcupada(dateStr, fechasOcupadas) {
  return (fechasOcupadas ?? []).some(
    (rango) => dateStr >= rango.fecha_inicio && dateStr <= rango.fecha_fin,
  );
}

function MonthCalendarRange({
  viewDate,
  fechaInicio,
  fechaFin,
  hoyStr,
  onDayClick,
  fechasOcupadas = [],
}) {
  const cells = buildMonthGrid(viewDate);
  const monthLabel = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <div className="min-w-0 flex-1">
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
          const ocupado = isDateOcupada(dateStr, fechasOcupadas);
          const isToday = dateStr === hoyStr;
          const isStart = dateStr === fechaInicio;
          const isEnd = dateStr === fechaFin;
          const inRange =
            fechaInicio &&
            fechaFin &&
            isInRange(dateStr, fechaInicio, fechaFin);
          const highlighted =
            inRange || isStart || (isEnd && fechaFin) || (isStart && !fechaFin);
          const selectable = !isPast && !ocupado;

          let bg = "#fff";
          let color = "#2a3a4a";
          let boxShadow;
          let cursor = "pointer";

          if (ocupado) {
            bg = "#fde8e8";
            color = "#c0392b";
            cursor = "not-allowed";
          } else if (isPast) {
            bg = "#f5f5f5";
            color = "#ccc";
            cursor = "not-allowed";
          } else if (highlighted) {
            bg = RANGE_HIGHLIGHT;
            color = BRAND.primary;
          }

          if (isToday && !isPast && !ocupado) {
            boxShadow = `inset 0 0 0 2px ${BRAND.primary}`;
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onDayClick(dateStr)}
              className="flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition-colors hover:enabled:bg-[#f7f7f7] disabled:cursor-not-allowed"
              style={{
                backgroundColor: bg,
                color,
                boxShadow,
                cursor,
              }}
              aria-label={dateStr}
            >
              {parseDateStr(dateStr).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarioRangoFechas({
  fechaInicio,
  fechaFin,
  onChange,
  onRangeComplete,
  onClear,
  clearLabel = "Borrar fechas",
  fechasOcupadas = [],
}) {
  const hoy = new Date();
  const hoyStr = getHoyStr();

  const [viewMonth, setViewMonth] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  );

  const nextMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );

  function shiftMonth(delta) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  function onDayClick(dateStr) {
    const next = handleRangeDayClick(dateStr, fechaInicio, fechaFin);
    onChange(next);
    if (next.desde && next.hasta) {
      onRangeComplete?.();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
          aria-label="Mes anterior"
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          onClick={() =>
            setViewMonth(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
          }
          className="text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: BRAND.primary }}
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
          aria-label="Mes siguiente"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <MonthCalendarRange
          viewDate={viewMonth}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          hoyStr={hoyStr}
          onDayClick={onDayClick}
          fechasOcupadas={fechasOcupadas}
        />
        <div className="hidden min-w-0 flex-1 lg:block">
          <MonthCalendarRange
            viewDate={nextMonth}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            hoyStr={hoyStr}
            onDayClick={onDayClick}
            fechasOcupadas={fechasOcupadas}
          />
        </div>
      </div>

      {(fechaInicio || fechaFin) && onClear && (
        <div className="mt-3 flex justify-end border-t pt-3" style={{ borderColor: BRAND.border }}>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#666" }}
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}
