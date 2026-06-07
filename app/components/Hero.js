"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import Navbar from "@/app/components/Navbar";
import { formatShortDate } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { supabase } from "@/lib/supabase";
import { BRAND, SERIF } from "./brand";

const TAB_IDS = ["todo", "alojamiento", "ninos", "mascotas"];

const VERTICAL_CARDS = [
  {
    id: "alojamiento",
    bg: "#1d4f91",
    borderTop: "#163a6b",
    titleKey: "alojamiento",
    labelKey: "alojamiento",
    fallbackCount: 124,
    fallbackPrice: 45,
    priceUnit: { es: "por noche", en: "per night" },
  },
  {
    id: "ninos",
    bg: "#0e7a5c",
    borderTop: "#085041",
    titleKey: "ninos",
    labelKey: "ninos",
    fallbackCount: 86,
    fallbackPrice: 15,
    priceUnit: { es: "por hora", en: "per hour" },
  },
  {
    id: "mascotas",
    bg: "#c47d1a",
    borderTop: "#92400e",
    titleKey: "mascotas",
    labelKey: "mascotas",
    fallbackCount: 58,
    fallbackPrice: 20,
    priceUnit: { es: "por día", en: "per day" },
  },
];

const METRICS = [
  { value: "340+", key: "proveedores" },
  { value: "1.200+", key: "reservas" },
  { value: "4.9", key: "valoracion" },
  { value: "30min", key: "garantia", isGarantia: true },
  { value: "98%", key: "satisfaccion" },
];

const HERO_EXTRA = {
  es: {
    headlineMain: "Todo lo que necesita tu familia, ",
    headlineEm: "aquí.",
    ciudad: "Ciudad",
    buscarBtn: "Buscar →",
    garantia: "Garantía",
    disponibles: (n) => `${n} disponibles`,
    desde: (n) => `desde ${n}€`,
    trust: [
      { color: "#1d4f91", text: "340+ verificados" },
      { color: "#0e7a5c", text: "Garantía 30 min" },
      { color: "#c47d1a", text: "Un solo pago" },
      { color: "#888", text: "Sin comisiones ocultas" },
    ],
  },
  en: {
    headlineMain: "Everything your family needs, ",
    headlineEm: "here.",
    ciudad: "City",
    buscarBtn: "Search →",
    garantia: "Guarantee",
    disponibles: (n) => `${n} available`,
    desde: (n) => `from €${n}`,
    trust: [
      { color: "#1d4f91", text: "340+ verified" },
      { color: "#0e7a5c", text: "30 min guarantee" },
      { color: "#c47d1a", text: "One payment" },
      { color: "#888", text: "No hidden fees" },
    ],
  },
};

function VerticalDivider() {
  return (
    <div
      className="hidden shrink-0 self-stretch md:block"
      style={{ width: 1, backgroundColor: "#e8e4de" }}
      aria-hidden
    />
  );
}

function SearchField({ label, children, onClick }) {
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
      className={`flex min-h-[44px] min-w-0 flex-1 flex-col justify-center px-5 py-2 md:py-0 ${onClick ? "cursor-pointer" : ""}`}
    >
      <span
        className="text-[8px] font-medium uppercase tracking-wide"
        style={{ color: "#bbb" }}
      >
        {label}
      </span>
      <div className="mt-0.5 min-h-[20px]">{children}</div>
    </div>
  );
}

function DateTrigger({ value, placeholder }) {
  return (
    <span
      className="block w-full text-[13px]"
      style={{ color: value ? "#2a3a4a" : "#bbb" }}
    >
      {value ? formatShortDate(value) : placeholder}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 19.5 15-15m0 0H8.25m11.25 0V11.25"
      />
    </svg>
  );
}

function VerticalCard({ card, stats, lang, extra, title, label, onClick }) {
  const count = stats?.count ?? card.fallbackCount;
  const minPrice = stats?.minPrice ?? card.fallbackPrice;
  const priceUnit = card.priceUnit[lang] || card.priceUnit.es;

  return (
    <button
      type="button"
      onClick={() => onClick(card.id)}
      className="relative w-full text-left transition-opacity hover:opacity-95"
      style={{
        backgroundColor: card.bg,
        borderTop: `3px solid ${card.borderTop}`,
        padding: "28px 24px 24px",
      }}
    >
      <span
        className="absolute right-5 top-5"
        style={{ color: "rgba(255,255,255,.2)" }}
      >
        <ArrowIcon />
      </span>

      <p
        className="text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,.45)" }}
      >
        {label}
      </p>

      <h3
        className="mt-2 leading-snug text-white"
        style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22 }}
      >
        {title}
      </h3>

      <p className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.4)" }}>
        {extra.disponibles(count)}
      </p>

      <p
        className="mt-5 leading-none text-white"
        style={{ fontSize: 28, fontWeight: 200 }}
      >
        {extra.desde(minPrice)}
      </p>
      <p className="mt-1 text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>
        {priceUnit}
      </p>
    </button>
  );
}

export default function Hero() {
  const router = useRouter();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const extra = HERO_EXTRA[lang] || HERO_EXTRA.es;
  const pickerRef = useRef(null);

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verticalStats, setVerticalStats] = useState({});

  const tabs = TAB_IDS.map((id) => ({
    id,
    label: t.hero[id],
  }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser ?? null);
    });
  }, []);

  useEffect(() => {
    async function loadVerticalStats() {
      const { data, error } = await supabase
        .from("services")
        .select("vertical, precio")
        .eq("disponible", true);

      if (error || !data?.length) return;

      const grouped = {};
      for (const service of data) {
        const vertical = service.vertical;
        if (!vertical) continue;

        if (!grouped[vertical]) {
          grouped[vertical] = { count: 0, minPrice: null };
        }

        grouped[vertical].count += 1;
        const precio = Number(service.precio);
        if (!Number.isNaN(precio)) {
          grouped[vertical].minPrice =
            grouped[vertical].minPrice == null
              ? precio
              : Math.min(grouped[vertical].minPrice, precio);
        }
      }

      setVerticalStats(grouped);
    }

    loadVerticalStats();
  }, []);

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

  function handleVerticalClick(vertical) {
    if (!user) {
      router.push("/registro");
      return;
    }
    router.push(`/buscar?vertical=${vertical}`);
  }

  function getCardTitle(card) {
    if (card.titleKey === "alojamiento") return t.footer.alojamiento;
    if (card.titleKey === "ninos") return t.footer.ninos;
    return t.footer.mascotas;
  }

  function getCardLabel(card) {
    if (card.labelKey === "alojamiento") return t.hero.alojamiento;
    if (card.labelKey === "ninos") return t.hero.ninos;
    return t.hero.mascotas;
  }

  return (
    <div style={{ backgroundColor: "#f7f5f2" }}>
      <Navbar />

      {/* Headline */}
      <section
        className="mx-auto max-w-6xl text-center"
        style={{ padding: "48px 28px 32px" }}
      >
        <div className="flex items-center justify-center gap-3">
          <span
            className="shrink-0"
            style={{ width: 32, height: 1, backgroundColor: "#1d4f91" }}
            aria-hidden
          />
          <p
            className="text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: "#1d4f91" }}
          >
            {t.hero.badge}
          </p>
          <span
            className="shrink-0"
            style={{ width: 32, height: 1, backgroundColor: "#1d4f91" }}
            aria-hidden
          />
        </div>

        <h1
          className="mx-auto mt-5 max-w-3xl leading-[1.15] text-[#111]"
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(28px, 5vw, 42px)",
          }}
        >
          {extra.headlineMain}
          <em className="italic" style={{ color: "#1d4f91" }}>
            {extra.headlineEm}
          </em>
        </h1>

        <p
          className="mx-auto mt-4 text-[13px] leading-[1.7]"
          style={{ color: "#888", maxWidth: 480 }}
        >
          {t.hero.subtitulo}
        </p>
      </section>

      {/* 3 vertical cards */}
      <section className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {VERTICAL_CARDS.map((card) => (
            <VerticalCard
              key={card.id}
              card={card}
              stats={verticalStats[card.id]}
              lang={lang}
              extra={extra}
              title={getCardTitle(card)}
              label={getCardLabel(card)}
              onClick={handleVerticalClick}
            />
          ))}
        </div>
      </section>

      {/* Search bar */}
      <div ref={pickerRef} className="relative">
        <form
          onSubmit={handleSearch}
          className="border-y bg-white"
          style={{ borderColor: "#e8e4de" }}
        >
          <div className="mx-auto flex max-w-6xl flex-col md:flex-row md:items-stretch">
            <SearchField label={extra.ciudad}>
              <input
                id="hero-ciudad"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.hero.placeholder}
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#bbb]"
                style={{ color: "#2a3a4a" }}
              />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField label={t.hero.llegada} onClick={openCalendar}>
              <DateTrigger value={fechaDesde} placeholder={t.hero.annadeFecha} />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField label={t.hero.salida} onClick={openCalendar}>
              <DateTrigger value={fechaHasta} placeholder={t.hero.annadeFecha} />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField
              label={t.hero.queNecesitas.replace("¿", "").replace("?", "")}
            >
              <select
                id="hero-vertical"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full cursor-pointer appearance-none bg-transparent text-[13px] font-medium outline-none"
                style={{ color: "#2a3a4a" }}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </SearchField>

            <button
              type="submit"
              className="w-full min-h-[44px] shrink-0 px-7 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 md:w-auto md:min-h-0 md:h-full"
              style={{
                backgroundColor: "#1d4f91",
                borderRadius: 0,
              }}
            >
              {extra.buscarBtn}
            </button>
          </div>
        </form>

        {calendarOpen && (
          <div
            className="absolute left-0 right-0 z-50 border-b bg-white p-5 shadow-xl"
            style={{ borderColor: BRAND.border }}
          >
            <div className="mx-auto max-w-6xl">
              <CalendarioRangoFechas
                fechaInicio={fechaDesde}
                fechaFin={fechaHasta}
                onChange={handleRangeChange}
                onRangeComplete={() => setCalendarOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <section
        style={{ backgroundColor: "#ede9e3" }}
        aria-label="Estadísticas de la plataforma"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-3 lg:grid-cols-5 lg:px-6">
          {METRICS.map((metric) => (
            <div key={metric.key} className="text-center">
              <p
                className="text-[20px] leading-none"
                style={{ color: "#1d4f91", fontWeight: 300 }}
              >
                {metric.value}
              </p>
              <p
                className="mt-1.5 text-[9px] font-medium uppercase tracking-wide"
                style={{ color: "#999" }}
              >
                {metric.isGarantia
                  ? extra.garantia
                  : t.metricsBar[metric.key]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust row */}
      <section
        className="border-t"
        style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
          {extra.trust.map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-[11px]" style={{ color: "#aaa" }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
