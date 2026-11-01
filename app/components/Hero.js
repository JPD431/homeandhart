"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import CiudadAutocompleteInput from "@/app/components/CiudadAutocompleteInput";
import { formatShortDate, parseDateStr } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { localizeHref } from "@/app/lib/locale";
import { useTranslation } from "@/app/lib/i18n";
import { supabase } from "@/app/lib/supabase";
import { BRAND, SERIF } from "./brand";

const TAB_IDS = ["todo", "alojamiento", "ninos", "mascotas"];

const VERTICAL_CARDS = [
  {
    id: "alojamiento",
    bg: "#1d4f91",
    borderTop: "#163a6b",
    titleKey: "alojamiento",
    labelKey: "alojamiento",
    priceUnit: { es: "por noche", en: "per night" },
  },
  {
    id: "ninos",
    bg: "#0e7a5c",
    borderTop: "#085041",
    titleKey: "ninos",
    labelKey: "ninos",
    priceUnit: { es: "por hora", en: "per hour" },
  },
  {
    id: "mascotas",
    bg: "#9a5b0c",
    borderTop: "#7a4509",
    titleKey: "mascotas",
    labelKey: "mascotas",
    priceUnit: { es: "por día", en: "per day" },
  },
];

const HERO_EXTRA = {
  es: {
    headlineMain: "Todo lo que necesita tu familia, ",
    headlineEm: "aquí.",
    ciudad: "Ciudad",
    buscarBtn: "Buscar",
    disponibles: (n) => `${n} disponibles`,
    desde: (n) => `desde ${n}€`,
  },
  en: {
    headlineMain: "Everything your family needs, ",
    headlineEm: "here.",
    ciudad: "City",
    buscarBtn: "Search",
    disponibles: (n) => `${n} available`,
    desde: (n) => `from €${n}`,
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

function SearchField({ label, htmlFor, children, onClick }) {
  // El clic en el contenedor solo es una comodidad para ratón; el control real
  // (botón/select/input) es el que recibe el foco y tiene nombre accesible.
  return (
    <div
      onClick={onClick}
      className={`flex min-h-[72px] min-w-0 flex-1 flex-col justify-center px-6 py-4 md:py-3 transition-colors ${onClick ? "cursor-pointer hover:bg-[#faf9f7]" : ""}`}
    >
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "#6b6b6b" }}
      >
        {label}
      </label>
      <div className="mt-1.5 min-h-[24px] overflow-visible">{children}</div>
    </div>
  );
}

function DateTrigger({
  id,
  value,
  placeholder,
  ariaLabel,
  expanded,
  onOpen,
  lang,
  triggerRef,
}) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className="block min-h-[24px] w-full text-left text-sm"
      style={{ color: value ? "#1a1a1a" : "#6b6b6b" }}
    >
      {value ? formatShortDate(value, lang) : placeholder}
    </button>
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

function VerticalCard({
  card,
  stats,
  statsLoaded,
  lang,
  extra,
  proximamenteLabel,
  title,
  label,
  onClick,
}) {
  const count = stats?.count ?? 0;
  const minPrice = stats?.minPrice ?? null;
  const priceUnit = card.priceUnit[lang] || card.priceUnit.es;
  const hasAvailability = statsLoaded && count > 0;
  const availabilityText = hasAvailability
    ? extra.disponibles(count)
    : proximamenteLabel;

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
        style={{ color: "rgba(255, 255, 255, 0.95)" }}
      >
        <ArrowIcon />
      </span>

      <span
        className="block text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,.95)" }}
      >
        {label}
      </span>

      <span
        className="mt-2 block leading-snug text-white"
        style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22 }}
      >
        {title}
      </span>

      <span className="mt-2 block text-[11px]" style={{ color: "rgba(255,255,255,.95)" }}>
        {availabilityText}
      </span>

      {hasAvailability && minPrice != null && (
        <>
          <p
            className="mt-5 leading-none text-white"
            style={{ fontSize: 28, fontWeight: 200 }}
          >
            {extra.desde(minPrice)}
          </p>
          <p className="mt-1 text-[10px]" style={{ color: "rgba(255,255,255,.95)" }}>
            {priceUnit}
          </p>
        </>
      )}
    </button>
  );
}

export default function Hero() {
  const router = useRouter();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const extra = HERO_EXTRA[lang] || HERO_EXTRA.es;
  const pickerRef = useRef(null);
  const llegadaRef = useRef(null);
  const salidaRef = useRef(null);
  const lastTriggerRef = useRef(null);

  const [activeTab, setActiveTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verticalStats, setVerticalStats] = useState({});
  const [statsLoaded, setStatsLoaded] = useState(false);

  function fullDate(dateStr) {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parseDateStr(dateStr));
  }

  const trustChips = [
    { color: "#0e7a5c", text: t.hero.trustGarantia },
    { color: "#c47d1a", text: t.hero.trustPago },
    { color: "#6b6b6b", text: t.hero.trustSinComisiones },
  ];

  const tabs = TAB_IDS.map((id) => ({
    id,
    label: t.hero[id],
  }));

  useEffect(() => {
    async function loadVerticalStats() {
      const { data, error } = await supabase
        .from("services")
        .select("vertical, precio, profiles_public!inner(verificado)")
        .eq("disponible", true)
        .eq("profiles_public.verificado", true);

      if (error || !data?.length) {
        setStatsLoaded(true);
        return;
      }

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
      setStatsLoaded(true);
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

    function handleEscape(e) {
      if (e.key === "Escape") {
        setCalendarOpen(false);
        lastTriggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [calendarOpen]);

  function openCalendar(triggerRef) {
    lastTriggerRef.current = triggerRef?.current ?? null;
    setCalendarOpen(true);
  }

  function closeCalendar({ restoreFocus = false } = {}) {
    setCalendarOpen(false);
    if (restoreFocus) lastTriggerRef.current?.focus();
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
    router.push(localizeHref(qs ? `/buscar?${qs}` : "/buscar", lang));
  }

  function handleVerticalClick(vertical) {
    router.push(localizeHref(`/buscar?vertical=${vertical}`, lang));
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
          style={{ color: "#6b6b6b", maxWidth: 480 }}
        >
          {t.hero.subtitulo}
        </p>
      </section>

      <section className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {VERTICAL_CARDS.map((card) => (
            <VerticalCard
              key={card.id}
              card={card}
              stats={verticalStats[card.id]}
              statsLoaded={statsLoaded}
              lang={lang}
              extra={extra}
              proximamenteLabel={t.hero.verProveedores}
              title={getCardTitle(card)}
              label={getCardLabel(card)}
              onClick={handleVerticalClick}
            />
          ))}
        </div>
      </section>

      <div ref={pickerRef} className="relative">
        <h2 className="sr-only">{t.hero.buscar}</h2>
        <form
          onSubmit={handleSearch}
          className="mx-auto flex max-w-6xl flex-col border-y bg-white md:flex-row md:items-stretch"
          style={{ borderColor: "#e8e4de", boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
        >
            <SearchField label={extra.ciudad} htmlFor="hero-ciudad">
              <CiudadAutocompleteInput
                id="hero-ciudad"
                value={query}
                onChange={setQuery}
                placeholder={t.hero.placeholder}
                className="w-full"
                inputClassName="min-h-[24px] w-full bg-transparent text-sm outline-none placeholder:text-[#6b6b6b]"
              />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField
              label={t.hero.llegada}
              htmlFor="hero-llegada"
              onClick={() => openCalendar(llegadaRef)}
            >
              <DateTrigger
                id="hero-llegada"
                triggerRef={llegadaRef}
                value={fechaDesde}
                lang={lang}
                placeholder={t.hero.annadeFecha}
                ariaLabel={
                  fechaDesde
                    ? t.a11y.llegadaValor(fullDate(fechaDesde))
                    : t.a11y.llegadaVacia
                }
                expanded={calendarOpen}
                onOpen={() => openCalendar(llegadaRef)}
              />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField
              label={t.hero.salida}
              htmlFor="hero-salida"
              onClick={() => openCalendar(salidaRef)}
            >
              <DateTrigger
                id="hero-salida"
                triggerRef={salidaRef}
                value={fechaHasta}
                lang={lang}
                placeholder={t.hero.annadeFecha}
                ariaLabel={
                  fechaHasta
                    ? t.a11y.salidaValor(fullDate(fechaHasta))
                    : t.a11y.salidaVacia
                }
                expanded={calendarOpen}
                onOpen={() => openCalendar(salidaRef)}
              />
            </SearchField>

            <div
              className="mx-5 h-px shrink-0 md:hidden"
              style={{ backgroundColor: "#e8e4de" }}
              aria-hidden
            />
            <VerticalDivider />

            <SearchField
              label={t.hero.queNecesitas.replace("¿", "").replace("?", "")}
              htmlFor="hero-vertical"
            >
              <select
                id="hero-vertical"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="min-h-[24px] w-full cursor-pointer appearance-none bg-transparent text-sm font-medium outline-none"
                style={{ color: "#1a1a1a" }}
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
              className="flex w-full min-h-[72px] shrink-0 items-center justify-center px-8 text-center text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 md:w-auto md:min-h-0 md:self-stretch"
              style={{
                backgroundColor: "#1d4f91",
                borderRadius: 0,
              }}
            >
              {extra.buscarBtn}
            </button>
        </form>

        {calendarOpen && (
          <div
            role="dialog"
            aria-label={t.a11y.selectorFechas}
            className="absolute left-0 right-0 z-50 border-b bg-white p-5 shadow-xl"
            style={{ borderColor: BRAND.border }}
          >
            <div className="mx-auto max-w-6xl">
              <CalendarioRangoFechas
                fechaInicio={fechaDesde}
                fechaFin={fechaHasta}
                onChange={handleRangeChange}
                onRangeComplete={() => closeCalendar({ restoreFocus: true })}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      <section
        className="border-t"
        style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
          {trustChips.map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-[11px]" style={{ color: "#6b6b6b" }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
