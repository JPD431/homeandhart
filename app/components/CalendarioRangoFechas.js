"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/app/components/brand";
import {
  ChevronIcon,
  RANGE_HIGHLIGHT,
  buildMonthGrid,
  getHoyStr,
  handleRangeDayClick,
  isInRange,
  parseDateStr,
  toDateStr,
} from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

function isDateOcupada(dateStr, fechasOcupadas) {
  return (fechasOcupadas ?? []).some(
    (rango) => dateStr >= rango.fecha_inicio && dateStr <= rango.fecha_fin,
  );
}

function addDays(dateStr, delta) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(dateStr, delta) {
  const d = parseDateStr(dateStr);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

function MonthCalendarRange({
  viewDate,
  fechaInicio,
  fechaFin,
  hoyStr,
  onDayClick,
  onDayKeyDown,
  focusedDate,
  fechasOcupadas = [],
  t,
  locale,
}) {
  const cells = buildMonthGrid(viewDate);
  const monthLabel = `${t.calendario.meses[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const fullDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-w-0 flex-1" role="group" aria-label={monthLabel}>
      <p className="mb-3 text-center text-sm font-semibold text-[#1a1a1a]">
        {monthLabel}
      </p>
      <div
        className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]"
        aria-hidden
      >
        {t.calendario.dias.map((label) => (
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
            color = "#a12a1e";
            cursor = "not-allowed";
          } else if (isPast) {
            bg = "#f5f5f5";
            color = "#6b6b6b";
            cursor = "not-allowed";
          } else if (highlighted) {
            bg = RANGE_HIGHLIGHT;
            color = BRAND.primary;
          }

          if (isToday && !isPast && !ocupado) {
            boxShadow = `inset 0 0 0 2px ${BRAND.primary}`;
          }

          const selected = isStart || (isEnd && !!fechaFin);
          const label = `${fullDate.format(parseDateStr(dateStr))}${
            selectable ? "" : ` (${t.calendario.noDisponible})`
          }`;

          return (
            <button
              key={dateStr}
              type="button"
              data-date={dateStr}
              aria-disabled={!selectable || undefined}
              tabIndex={dateStr === focusedDate ? 0 : -1}
              onClick={() => selectable && onDayClick(dateStr)}
              onKeyDown={(e) => onDayKeyDown(e, dateStr)}
              className="flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition-colors hover:enabled:bg-[#f7f7f7]"
              style={{
                backgroundColor: bg,
                color,
                boxShadow,
                cursor,
              }}
              aria-label={label}
              aria-pressed={selected}
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
  clearLabel,
  fechasOcupadas = [],
  autoFocus = false,
}) {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const locale = lang === "en" ? "en-GB" : "es-ES";
  const rootRef = useRef(null);
  const shouldFocus = useRef(autoFocus);
  const hoy = new Date();
  const hoyStr = getHoyStr();

  const [focusedDate, setFocusedDate] = useState(
    () => fechaFin || fechaInicio || hoyStr,
  );
  const [viewMonth, setViewMonth] = useState(() => {
    const base = parseDateStr(fechaInicio || hoyStr);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const nextMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );

  // Mueve el foco al día activo cuando se pidió (apertura o navegación por teclado).
  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    rootRef.current?.querySelector(`[data-date="${focusedDate}"]`)?.focus();
  }, [focusedDate, viewMonth]);

  function shiftMonth(delta) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  function moveFocus(target) {
    const d = parseDateStr(target);
    const lastVisible = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 2,
      0,
    );
    if (d < viewMonth || d > lastVisible) {
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    shouldFocus.current = true;
    setFocusedDate(target);
  }

  function onDayKeyDown(e, dateStr) {
    const weekday = (parseDateStr(dateStr).getDay() + 6) % 7;
    const moves = {
      ArrowLeft: addDays(dateStr, -1),
      ArrowRight: addDays(dateStr, 1),
      ArrowUp: addDays(dateStr, -7),
      ArrowDown: addDays(dateStr, 7),
      Home: addDays(dateStr, -weekday),
      End: addDays(dateStr, 6 - weekday),
      PageUp: addMonths(dateStr, e.shiftKey ? -12 : -1),
      PageDown: addMonths(dateStr, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveFocus(moves[e.key]);
    }
  }

  function onDayClick(dateStr) {
    setFocusedDate(dateStr);
    const next = handleRangeDayClick(dateStr, fechaInicio, fechaFin);
    onChange(next);
    if (next.desde && next.hasta) {
      onRangeComplete?.();
    }
  }

  const monthProps = {
    fechaInicio,
    fechaFin,
    hoyStr,
    onDayClick,
    onDayKeyDown,
    focusedDate,
    fechasOcupadas,
    t,
    locale,
  };

  return (
    <div ref={rootRef}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
          aria-label={t.calendario.mesAnterior}
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          onClick={() =>
            setViewMonth(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
          }
          className="min-h-[44px] px-3 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: BRAND.primary }}
        >
          {t.calendario.hoy}
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
          aria-label={t.calendario.mesSiguiente}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <MonthCalendarRange viewDate={viewMonth} {...monthProps} />
        <div className="hidden min-w-0 flex-1 lg:block">
          <MonthCalendarRange viewDate={nextMonth} {...monthProps} />
        </div>
      </div>

      {(fechaInicio || fechaFin) && onClear && (
        <div
          className="mt-3 flex justify-end border-t pt-3"
          style={{ borderColor: BRAND.border }}
        >
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] px-2 text-xs font-medium text-[#555] transition-opacity hover:opacity-80"
          >
            {clearLabel ?? t.calendario.borrarFechas}
          </button>
        </div>
      )}
    </div>
  );
}
