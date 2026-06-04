"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "./brand";

const TABS = [
  { id: "todo", label: "Todo", color: BRAND.primary },
  { id: "alojamiento", label: "Alojamiento", color: "#1d4f91" },
  { id: "ninos", label: "Niños", color: "#0e7a5c" },
  { id: "mascotas", label: "Mascotas", color: "#c47d1a" },
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

function SearchSection({ label, children, className = "" }) {
  return (
    <div
      className={`group flex min-w-0 flex-1 flex-col justify-center px-5 py-4 transition-colors hover:bg-[#f7f7f7] lg:py-3 ${className}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
        {label}
      </span>
      <div className="mt-0.5 min-h-[28px]">{children}</div>
    </div>
  );
}

function DateField({ id, value, onChange, min }) {
  return (
    <div className="relative w-full">
      {!value && (
        <span
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm text-[#999]"
          aria-hidden
        >
          Añade una fecha
        </span>
      )}
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={onChange}
        className={`w-full cursor-pointer bg-transparent text-sm text-[#1a1a1a] outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
          value ? "" : "text-transparent"
        }`}
      />
    </div>
  );
}

export default function Hero() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0];

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
          Marketplace de confianza
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#1a1a1a] sm:text-4xl lg:text-5xl">
          Por fin, todo lo que necesitas en un solo lugar
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#5c5c5c] sm:text-lg">
          Alojamiento, cuidado de niños y mascotas — encuentra proveedores
          verificados cerca de ti, con reserva sencilla y segura.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        <form
          onSubmit={handleSearch}
          className="overflow-hidden rounded-[32px] border border-[#ebebeb] bg-white shadow-lg lg:rounded-[50px]"
        >
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <SearchSection label="¿Dónde?" className="lg:rounded-l-[50px]">
              <input
                id="hero-ciudad"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca una ciudad o barrio"
                className="w-full bg-transparent text-sm text-[#1a1a1a] outline-none placeholder:text-[#999]"
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label="Llegada">
              <DateField
                id="hero-desde"
                value={fechaDesde}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label="Salida">
              <DateField
                id="hero-hasta"
                value={fechaHasta}
                min={fechaDesde || new Date().toISOString().split("T")[0]}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </SearchSection>

            <div
              className="mx-5 h-px shrink-0 bg-[#ebebeb] lg:hidden"
              aria-hidden
            />
            <VerticalDivider />

            <SearchSection label="¿Qué necesitas?">
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
                  {TABS.map((tab) => (
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
                aria-label="Buscar"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
