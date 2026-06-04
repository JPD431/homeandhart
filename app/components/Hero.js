"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import { formatShortDate } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND } from "./brand";

const TAB_IDS = [
  { id: "todo", color: BRAND.primary },
  { id: "alojamiento", color: "#1d4f91" },
  { id: "ninos", color: "#0e7a5c" },
  { id: "mascotas", color: "#c47d1a" },
];

function SearchIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

function VerticalDivider() {
  return (
    <div
      className="hidden shrink-0 self-center lg:block"
      style={{
        width: 1,
        height: 32,
        backgroundColor: BRAND.border,
      }}
      aria-hidden
    />
  );
}

function SearchSection({ label, children, className = "", onClick }) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group flex min-w-0 flex-1 flex-col justify-center px-5 py-4 transition-colors hover:bg-[#f7f7f7] lg:py-3 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
        {label}
      </span>
      <div className="mt-0.5 min-h-[28px]">{children}</div>
    </div>
  );
}

function DateTrigger({ value, placeholder }) {
  return (
    <span
      className="block w-full text-sm"
      style={{ color: value ? "#1a1a1a" : "#999" }}
    >
      {value ? formatShortDate(value) : placeholder}
    </span>
  );
}

export default function Hero() {
  const router = useRouter();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const pickerRef = useRef(null);
  const [activeTab, setActiveTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const tabs = TAB_IDS.map((tab) => ({
    ...tab,
    label: t.hero[tab.id],
  }));
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    if (!calendarOpen) return;

    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  function openCalendar() {
    setCalendarOpen(true);
  }

  function handleRangeChange({ desde, hasta }) {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }

  function handleSearch(e) {
    e.preventDefault();

    const params = new URLSearchParams();
    const ciudad = query.trim();
    if (ciudad) params.set("ciudad", ciudad);
    if (fechaDesde) params.set("desde", fechaDesde);
    if (fechaHasta) params.set("hasta", fechaHasta);
    if (activeTab !== "todo") params.set("vertical", activeTab);

    const qs = params.toString();
    router.push(qs ? `/buscar?${qs}` : "/buscar");
  }

  return (
    <section className="px-4 pb-8 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium tracking-wide sm:text-sm"
          style={{
            backgroundColor: BRAND.light,
            color: BRAND.primary,
          }}
        >
          {t.hero.badge}
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#1a1a1a] sm:text-4xl lg:text-5xl">
          {t.hero.titulo}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#5c5c5c] sm:text-lg">
          {t.hero.subtitulo}
        </p>
      </div>

      <div ref={pickerRef} className="relative mx-auto mt-10 max-w-5xl">
        <form
          onSubmit={handleSearch}
          className="overflow-hidden rounded-[32px] border border-[#ebebeb] bg-white shadow-lg lg:rounded-[50px]"
        >
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <SearchSection label={t.hero.donde} className="lg:rounded-l-[50px]">
              <input
                id="hero-ciudad"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.hero.placeholder}
                className="w-full bg-transparent text-sm text-[#1a1a1a] outline-none placeholder:text-[#999]"
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label={t.hero.llegada} onClick={openCalendar}>
              <DateTrigger
                value={fechaDesde}
                placeholder={t.hero.annadeFecha}
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label={t.hero.salida} onClick={openCalendar}>
              <DateTrigger
                value={fechaHasta}
                placeholder={t.hero.annadeFecha}
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label={t.hero.queNecesitas}>
              <div className="relative flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: activeTabConfig.color }}
                  aria-hidden
                />
                <select
                  id="hero-vertical"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm font-medium outline-none"
                  style={{ color: activeTabConfig.color }}
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-0 h-4 w-4 text-[#888]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </div>
            </SearchSection>

            <div className="flex items-center justify-center p-3 lg:pr-3">
              <button
                type="submit"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 lg:h-12 lg:w-12"
                style={{ backgroundColor: BRAND.primary }}
                aria-label={t.hero.buscar}
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>

        {calendarOpen && (
          <div
            className="absolute left-0 right-0 z-50 mt-3 rounded-2xl border bg-white p-5 shadow-xl sm:p-6"
            style={{ borderColor: BRAND.border }}
          >
            <CalendarioRangoFechas
              fechaInicio={fechaDesde}
              fechaFin={fechaHasta}
              onChange={handleRangeChange}
              onRangeComplete={() => setCalendarOpen(false)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
