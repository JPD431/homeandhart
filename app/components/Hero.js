"use client";

import { useState } from "react";
import { BRAND } from "./brand";

const TABS = [
  { id: "todo", label: "Todo" },
  { id: "alojamiento", label: "Alojamiento" },
  { id: "ninos", label: "Niños" },
  { id: "mascotas", label: "Mascotas" },
];

const PLACEHOLDERS = {
  todo: "¿Qué necesitas? Alojamiento, cuidado infantil, mascotas…",
  alojamiento: "Ciudad, barrio o dirección",
  ninos: "Tipo de cuidado, edad del niño o zona",
  mascotas: "Tipo de mascota, servicio o zona",
};

function SearchIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
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

function LocationIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

export default function Hero() {
  const [activeTab, setActiveTab] = useState("todo");
  const [query, setQuery] = useState("");

  function handleSearch(e) {
    e.preventDefault();
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

      <div className="mx-auto mt-10 max-w-3xl">
        <div
          className="overflow-hidden rounded-2xl border bg-white shadow-sm shadow-black/[0.04]"
          style={{ borderColor: BRAND.border }}
        >
          <div
            className="flex border-b"
            style={{
              borderColor: BRAND.border,
              backgroundColor: BRAND.warm,
            }}
            role="tablist"
            aria-label="Tipo de búsqueda"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex-1 px-2 py-3.5 text-xs font-medium transition-colors sm:px-4 sm:py-4 sm:text-sm"
                  style={{
                    color: isActive ? BRAND.primary : "#666",
                    backgroundColor: isActive ? "#fff" : "transparent",
                  }}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5"
                      style={{ backgroundColor: BRAND.primary }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSearch} className="p-4 sm:p-6">
            <label htmlFor="search-query" className="sr-only">
              Buscar
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div
                className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-3"
                style={{ borderColor: BRAND.border }}
              >
                <LocationIcon className="h-5 w-5 shrink-0 text-[#1d4f91]" />
                <input
                  id="search-query"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={PLACEHOLDERS[activeTab]}
                  className="w-full bg-transparent text-sm text-[#1a1a1a] outline-none placeholder:text-[#999] sm:text-base"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:shrink-0"
                style={{ backgroundColor: BRAND.primary }}
              >
                <SearchIcon className="h-4 w-4" />
                Buscar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
