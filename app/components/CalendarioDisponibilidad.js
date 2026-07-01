"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  ChevronIcon,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  buildMonthGrid,
  formatShortDate,
  getHoyStr,
  handleRangeDayClick,
  isInRange,
  parseDateStr,
} from "@/app/components/calendario-shared";

const DIA_ID_BY_JS = {
  0: "dom",
  1: "lun",
  2: "mar",
  3: "mie",
  4: "jue",
  5: "vie",
  6: "sab",
};

function getDiaIdFromDateStr(dateStr) {
  return DIA_ID_BY_JS[parseDateStr(dateStr).getDay()];
}

function isDateOccupied(dateStr, bloqueos) {
  return bloqueos.some(
    (b) => dateStr >= b.fecha_inicio && dateStr <= b.fecha_fin,
  );
}

function isWeekdayAllowed(dateStr, diasDisponibles) {
  return diasDisponibles.includes(getDiaIdFromDateStr(dateStr));
}

function MonthCalendar({
  viewDate,
  bloqueos,
  diasDisponibles,
  fechaInicio,
  fechaFin,
  hoyStr,
  onDayClick,
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

          const occupied = isDateOccupied(dateStr, bloqueos);
          const weekdayOk = isWeekdayAllowed(dateStr, diasDisponibles);
          const isToday = dateStr === hoyStr;
          const isStart = dateStr === fechaInicio;
          const isEnd = dateStr === fechaFin;
          const inRange =
            fechaInicio &&
            fechaFin &&
            isInRange(dateStr, fechaInicio, fechaFin);
          const selectable = weekdayOk && !occupied && dateStr >= hoyStr;

          let bg = "#dcfce7";
          let color = "#166534";
          let decoration = "none";
          let boxShadow;
          let cursor = selectable ? "pointer" : "default";
          let opacity = 1;

          if (!weekdayOk) {
            bg = "#f3f4f6";
            color = "#d1d5db";
          } else if (occupied) {
            bg = "#e5e7eb";
            color = "#9ca3af";
            decoration = "line-through";
          } else if (inRange || isStart || isEnd) {
            bg = BRAND.light;
            color = BRAND.primary;
          }

          if (isToday) {
            boxShadow = `inset 0 0 0 2px ${BRAND.primary}`;
          }

          if (!selectable && !isToday && weekdayOk && !occupied) {
            opacity = 0.45;
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onDayClick(dateStr)}
              className="flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:cursor-default"
              style={{
                backgroundColor: bg,
                color,
                textDecoration: decoration,
                boxShadow,
                cursor,
                opacity,
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

export default function CalendarioDisponibilidad({
  services,
  bloqueos,
  initialDesde = "",
  initialHasta = "",
  embedded = false,
  singleMonth = false,
  showReservaLink = true,
  onDatesChange,
}) {
  const hoy = new Date();
  const hoyStr = getHoyStr();

  const [viewMonth, setViewMonth] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id ?? "",
  );
  const [fechaInicio, setFechaInicio] = useState(initialDesde);
  const [fechaFin, setFechaFin] = useState(initialHasta);

  useEffect(() => {
    setFechaInicio(initialDesde);
    setFechaFin(initialHasta);
  }, [initialDesde, initialHasta]);

  useEffect(() => {
    onDatesChange?.({ desde: fechaInicio, hasta: fechaFin });
  }, [fechaInicio, fechaFin, onDatesChange]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? services[0],
    [services, selectedServiceId],
  );

  const serviceBloqueos = useMemo(
    () =>
      bloqueos.filter((b) => b.service_id === selectedService?.id),
    [bloqueos, selectedService],
  );

  const diasDisponibles = selectedService?.dias_disponibles ?? [];

  const nextMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );

  function shiftMonth(delta) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  function handleDayClick(dateStr) {
    const next = handleRangeDayClick(dateStr, fechaInicio, fechaFin);
    setFechaInicio(next.desde);
    setFechaFin(next.hasta);
  }

  const reservaHref = useMemo(() => {
    if (!selectedService?.id || !fechaInicio) return null;
    const params = new URLSearchParams();
    params.set("desde", fechaInicio);
    params.set("hasta", fechaFin || fechaInicio);
    return `/reservar/${selectedService.id}?${params.toString()}`;
  }, [selectedService, fechaInicio, fechaFin]);

  const reservaLabel = useMemo(() => {
    if (!fechaInicio) return "";
    const fin = fechaFin || fechaInicio;
    if (fechaInicio === fin) {
      return `Reservar ${formatShortDate(fechaInicio)}`;
    }
    return `Reservar ${formatShortDate(fechaInicio)} – ${formatShortDate(fin)}`;
  }, [fechaInicio, fechaFin]);

  if (!services.length) return null;

  const sectionClass = embedded
    ? ""
    : "mt-8 rounded-2xl border bg-white p-6 sm:p-8";

  const sectionStyle = embedded ? undefined : { borderColor: BRAND.border };

  return (
    <section className={sectionClass} style={sectionStyle}>
      {!embedded && (
        <>
          <h2
            className="text-xl font-bold text-[#1a1a1a] sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Disponibilidad
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Elige tus fechas en el calendario y reserva directamente.
          </p>
        </>
      )}

      {embedded && (
        <p className="mb-3 text-[11px] font-medium text-[#666]">
          Elige tus fechas
        </p>
      )}

      {services.length > 1 && (
        <div className="mt-5">
          <label
            htmlFor="calendario-servicio"
            className="mb-1.5 block text-xs font-medium text-[#444]"
          >
            Servicio
          </label>
          <select
            id="calendario-servicio"
            value={selectedServiceId}
            onChange={(e) => {
              setSelectedServiceId(e.target.value);
              setFechaInicio("");
              setFechaFin("");
            }}
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
            style={{ borderColor: BRAND.border }}
          >
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.titulo || svc.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
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
          className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[#f7f7f7]"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
          aria-label="Mes siguiente"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div
        className={`flex flex-col gap-6 ${embedded ? "mt-0" : "mt-4"} ${singleMonth ? "" : "lg:flex-row lg:gap-8"}`}
      >
        <MonthCalendar
          viewDate={viewMonth}
          bloqueos={serviceBloqueos}
          diasDisponibles={diasDisponibles}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          hoyStr={hoyStr}
          onDayClick={handleDayClick}
        />
        {!singleMonth && (
          <div className="hidden min-w-0 flex-1 lg:block">
            <MonthCalendar
              viewDate={nextMonth}
              bloqueos={serviceBloqueos}
              diasDisponibles={diasDisponibles}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              hoyStr={hoyStr}
              onDayClick={handleDayClick}
            />
          </div>
        )}
      </div>

      <div
        className={`flex flex-wrap gap-3 text-xs text-[#666] ${embedded ? "mt-3" : "mt-5"}`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#dcfce7]" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#e5e7eb] line-through" /> Ocupado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#f3f4f6]" /> No disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded border-2"
            style={{ borderColor: BRAND.primary }}
          />{" "}
          Hoy
        </span>
      </div>

      {showReservaLink && reservaHref && (
        <Link
          href={reservaHref}
          className="mt-6 block w-full rounded-xl py-3.5 text-center text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
          style={{ backgroundColor: BRAND.primary }}
        >
          {reservaLabel}
        </Link>
      )}
    </section>
  );
}
