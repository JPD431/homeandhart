"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import { formatShortDate } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const FILTER_TABS = [
  { id: "todo", color: "#1d4f91", light: "#e8f0fb" },
  { id: "alojamiento", color: "#1d4f91", light: "#e8f0fb" },
  { id: "ninos", color: "#0e7a5c", light: "#e6f4f0" },
  { id: "mascotas", color: "#c47d1a", light: "#fdf3e3" },
];

const VERTICAL_THEME = {
  alojamiento: {
    label: "Alojamiento",
    color: "#1d4f91",
    light: "#e8f0fb",
    priceSuffix: "/ noche",
    priceShort: "n",
    gradient: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    color: "#0e7a5c",
    light: "#e6f4f0",
    priceSuffix: "/ hora",
    priceShort: "h",
    gradient: "linear-gradient(160deg, #a8d5c2, #3d9b86)",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    color: "#c47d1a",
    light: "#fdf3e3",
    priceSuffix: "/ día",
    priceShort: "d",
    gradient: "linear-gradient(160deg, #e8c99a, #b8843a)",
    Icon: PetIcon,
  },
};

const TIPO_ALOJAMIENTO_LABELS = {
  completo: "Alojamiento completo",
  habitacion_privada: "Habitación privada",
  habitacion_compartida: "Habitación compartida",
  habitacion_hotel: "Habitación de hotel",
  otros: "Otros",
};

const MODALIDAD_LABELS = {
  domicilio_cliente: "En tu domicilio",
  domicilio_proveedor: "En su domicilio",
  ambas: "Ambas modalidades",
};

const PIN_POSITIONS = [
  { left: 36, top: 30 },
  { left: 58, top: 22 },
  { left: 26, top: 46 },
  { left: 66, top: 40 },
  { left: 44, top: 56 },
  { left: 72, top: 28 },
  { left: 32, top: 62 },
  { left: 54, top: 38 },
  { left: 48, top: 18 },
  { left: 62, top: 54 },
];

const NEIGHBORHOOD_LABELS = [
  { left: 14, top: 16, text: "Centro" },
  { left: 52, top: 12, text: "Norte" },
  { left: 22, top: 52, text: "Este" },
  { left: 68, top: 48, text: "Oeste" },
];

const BUSCAR_EXTRA = {
  es: {
    miCuenta: "Mi cuenta",
    reservar: (price, suffix) => `Reservar · ${price}${suffix}`,
    reservarAhora: "Reservar ahora",
    ubicacionAprox: "Ubicación aproximada · zona/barrio",
    fechas: "Fechas",
    estrellas: "4.9",
  },
  en: {
    miCuenta: "My account",
    reservar: (price, suffix) => `Book · ${price}${suffix}`,
    reservarAhora: "Book now",
    ubicacionAprox: "Approximate location · area/neighbourhood",
    fechas: "Dates",
    estrellas: "4.9",
  },
};

function HomeIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function PersonIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function PetIcon({ className, style }) {
  return (
    <svg className={className} style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7" cy="4" r="1.5" /><circle cx="12" cy="3" r="1.5" /><circle cx="17" cy="4" r="1.5" /><circle cx="4.5" cy="8.5" r="1.5" />
      <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function getInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function formatShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

function formatPrice(precio, suffix) {
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${suffix}`;
}

function formatPinPrice(precio, priceShort) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio)}€/${priceShort}`;
}

function getServiceZone(service, profile) {
  return (
    service.location_zone ||
    profile?.location_zone ||
    service.ciudad ||
    profile?.ciudad ||
    "Zona"
  );
}

function getSubtypeLabel(service) {
  if (service.vertical === "alojamiento" && service.tipo_alojamiento) {
    return TIPO_ALOJAMIENTO_LABELS[service.tipo_alojamiento] || service.tipo_alojamiento;
  }
  if (service.modalidad) {
    return MODALIDAD_LABELS[service.modalidad] || service.modalidad;
  }
  return null;
}

function hasPetFriendlyInDescription(service) {
  const desc = (service.descripcion || "").toLowerCase();
  return /pet[-_\s]?friendly/i.test(desc);
}

function getServiceTags(service, profile, lang) {
  const tags = [];

  if (service.reserva_inmediata === true) {
    tags.push({ text: "Reserva inmediata ⚡", light: "#fdf3e3", color: "#92400e" });
  } else {
    tags.push({ text: "Reserva con confirmación 🕐", light: "#f7f5f2", color: "#888" });
  }

  if (profile?.verificado === true) {
    tags.push({ text: "Verificado ✓", light: "#e8f0fb", color: "#163a6b" });
  }

  if (
    service.vertical === "alojamiento" &&
    (service.disponible_para_viajar || hasPetFriendlyInDescription(service))
  ) {
    tags.push({ text: "Pet-friendly 🐾", light: "#e6f4f0", color: "#085041" });
  }

  const languages = Array.isArray(profile?.idiomas) ? profile.idiomas : [];
  if (languages[0]) {
    tags.push({ text: languages[0], light: "#f3f3f3", color: "#666" });
  }

  const avalesCount = Number(service.avales_count) || 0;
  if (avalesCount > 0) {
    const avalesLabel =
      lang === "en"
        ? `${avalesCount} endorsement${avalesCount !== 1 ? "s" : ""}`
        : `${avalesCount} aval${avalesCount !== 1 ? "es" : ""}`;
    tags.push({ text: avalesLabel, light: "#f7f5f2", color: "#888" });
  }

  return tags;
}

function BuscarNavbar({ user, t, extra }) {
  return (
    <header
      className="border-b"
      style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de" }}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0 no-underline">
          <p className="text-[18px] leading-none text-[#111]" style={{ fontFamily: SERIF }}>
            Home<span className="italic" style={{ color: "#1d4f91" }}>&</span>
            Heart
          </p>
          <p className="mt-1 text-[9px]" style={{ color: "#bbb" }}>
            {t.footer.slogan}
          </p>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Principal">
          <Link href="/buscar" className="no-underline" style={{ color: "#1d4f91", fontSize: 12 }}>
            {t.navbar.servicios}
          </Link>
          <Link href="/garantia" className="no-underline transition-colors hover:text-[#1d4f91]" style={{ color: "#888", fontSize: 12 }}>
            {t.navbar.garantia}
          </Link>
          <Link href="/ser-proveedor" className="no-underline transition-colors hover:text-[#1d4f91]" style={{ color: "#888", fontSize: 12 }}>
            {t.navbar.serProveedor}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 text-[12px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1d4f91", borderRadius: 4 }}
            >
              {extra.miCuenta}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-[12px] font-medium no-underline sm:inline-block" style={{ color: "#1d4f91" }}>
                {t.navbar.iniciarSesion}
              </Link>
              <Link
                href="/registro"
                className="px-3.5 py-1.5 text-[12px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1d4f91", borderRadius: 4 }}
              >
                {t.navbar.registrarse}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function StaticMap({
  results,
  hoveredIndex,
  selectedIndex,
  onPinHover,
  onPinLeave,
  onPinSelect,
  extra,
  t,
}) {
  const selected = selectedIndex != null ? results[selectedIndex] : null;
  const selectedProfile = selected?.profiles ?? {};
  const selectedTheme = selected
    ? VERTICAL_THEME[selected.vertical] ?? VERTICAL_THEME.alojamiento
    : null;
  const SelectedIcon = selectedTheme?.Icon;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: "100%",
        position: "relative",
        backgroundColor: "#eef2f7",
        backgroundImage: `
          linear-gradient(rgba(200, 212, 228, 0.45) 1px, transparent 1px),
          linear-gradient(90deg, rgba(200, 212, 228, 0.45) 1px, transparent 1px)
        `,
        backgroundSize: "28px 28px",
      }}
    >
      {/* Calles simuladas */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute bottom-0 left-[22%] top-0 w-[2px]" style={{ backgroundColor: "#c8d4e4" }} />
        <div className="absolute bottom-0 left-[52%] top-0 w-[3px]" style={{ backgroundColor: "#c8d4e4" }} />
        <div className="absolute bottom-0 left-[78%] top-0 w-[2px]" style={{ backgroundColor: "#c8d4e4" }} />
        <div className="absolute left-0 right-0 top-[34%] h-[2px]" style={{ backgroundColor: "#c8d4e4" }} />
        <div className="absolute left-0 right-0 top-[58%] h-[3px]" style={{ backgroundColor: "#c8d4e4" }} />
      </div>

      {NEIGHBORHOOD_LABELS.map((label) => (
        <span
          key={label.text}
          className="pointer-events-none absolute text-[8px] font-semibold uppercase tracking-widest"
          style={{ left: `${label.left}%`, top: `${label.top}%`, color: "#c8d4e4" }}
        >
          {label.text}
        </span>
      ))}

      {/* Leyenda */}
      <div
        className="absolute right-3 top-3 flex items-center gap-2 rounded-md px-2.5 py-1.5"
        style={{ backgroundColor: "rgba(255,255,255,.75)" }}
      >
        {["alojamiento", "ninos", "mascotas"].map((key) => (
          <span
            key={key}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: VERTICAL_THEME[key].color }}
            aria-hidden
          />
        ))}
      </div>

      {/* Pins */}
      {results.map((service, index) => {
        const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
        const pos = PIN_POSITIONS[index % PIN_POSITIONS.length];
        const isHovered = hoveredIndex === index;
        const isSelected = selectedIndex === index;

        return (
          <button
            key={service.id}
            type="button"
            onMouseEnter={() => onPinHover(index)}
            onMouseLeave={onPinLeave}
            onClick={() => onPinSelect(index)}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border-0 px-2.5 py-1 text-[11px] font-bold text-white"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              backgroundColor: theme.color,
              borderRadius: 9999,
              boxShadow: isSelected
                ? `0 4px 14px ${theme.color}66`
                : "0 2px 8px rgba(0,0,0,0.15)",
              transform: `translate(-50%, -50%) scale(${isHovered || isSelected ? 1.06 : 1})`,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              zIndex: isHovered || isSelected ? 10 : 1,
            }}
          >
            {formatPinPrice(service.precio, theme.priceShort)}
          </button>
        );
      })}

      {/* Nota inferior */}
      <p
        className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[9px]"
        style={{ color: "#aab4c4", paddingBottom: selected ? 72 : 0 }}
      >
        {extra.ubicacionAprox}
      </p>

      {/* Panel de detalle */}
      {selected && selectedTheme && (
        <div
          className="absolute bottom-0 left-0 right-0 border-t bg-white px-3 py-3"
          style={{ borderColor: "#e8e4de" }}
        >
          <div className="flex items-center gap-3">
            {selected.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.foto_url}
                alt=""
                className="h-11 w-11 shrink-0 object-cover"
                style={{ borderRadius: 6 }}
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center"
                style={{ borderRadius: 6, background: selectedTheme.gradient }}
              >
                {SelectedIcon && <SelectedIcon className="h-5 w-5 text-white" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#1a1a1a]">
                {formatShortName(selectedProfile.nombre, selectedProfile.apellido) || "Proveedor"}
              </p>
              <p className="truncate text-[10px] text-[#888]">
                {selected.titulo || selectedTheme.label} · {getServiceZone(selected, selectedProfile)}
              </p>
              <p className="text-[12px] font-bold" style={{ color: selectedTheme.color }}>
                {formatPrice(selected.precio, selectedTheme.priceSuffix)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <Link
                href={`/reservar/${selected.id}`}
                className="rounded px-3 py-1.5 text-center text-[11px] font-semibold text-white no-underline"
                style={{ backgroundColor: BRAND.primary }}
              >
                {extra.reservarAhora}
              </Link>
              <Link
                href={`/proveedor/${selected.proveedor_id || selectedProfile.id}`}
                className="rounded border px-3 py-1.5 text-center text-[11px] font-semibold no-underline"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                {t.buscar.verPerfil}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  index,
  isActive,
  onHover,
  onLeave,
  onSelect,
  extra,
  t,
  lang,
}) {
  const profile = service.profiles ?? {};
  const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
  const zone = getServiceZone(service, profile);
  const tags = getServiceTags(service, profile, lang);
  const priceLabel = formatPrice(service.precio, theme.priceSuffix);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(index)}
        onMouseEnter={() => onHover(index)}
        onMouseLeave={onLeave}
        className="w-full overflow-hidden border-b text-left transition-colors"
        style={{
          borderColor: "#e8e4de",
          borderLeft: isActive ? "2px solid #1d4f91" : "2px solid transparent",
          backgroundColor: isActive ? "#fafaf9" : "#fff",
        }}
      >
        <div className="relative h-[160px] w-full overflow-hidden">
          {service.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.foto_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: theme.gradient }} />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.55) 100%)",
            }}
            aria-hidden
          />
          <span
            className="absolute right-2.5 top-2.5 px-2.5 py-1 text-[10px] font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,.92)",
              borderRadius: 14,
              color: "#2a3a4a",
            }}
          >
            {priceLabel}
          </span>
          <span
            className="absolute bottom-2 left-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{
              backgroundColor: theme.color,
              border: "1.5px solid rgba(255,255,255,.7)",
            }}
          >
            {getInitials(profile.nombre, profile.apellido)}
          </span>
        </div>

        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[12px] font-semibold text-[#1a1a1a]">
              {formatShortName(profile.nombre, profile.apellido) || "Proveedor"}
              <span className="font-normal text-[#888]"> · {zone}</span>
            </p>
            <span className="shrink-0 text-[10px] text-[#c47d1a]">
              ★ {extra.estrellas}
            </span>
          </div>

          {service.titulo && (
            <p className="mt-0.5 truncate text-[10px] text-[#aaa]">{service.titulo}</p>
          )}

          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag.text}
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: tag.light, color: tag.color }}
                >
                  {tag.text}
                </span>
              ))}
            </div>
          )}

          <Link
            href={`/reservar/${service.id}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 block w-full rounded py-2 text-center text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.color }}
          >
            {extra.reservar(
              service.precio != null && service.precio !== "" ? `${Number(service.precio)}€` : "—",
              theme.priceSuffix,
            )}
          </Link>
        </div>
      </button>
    </li>
  );
}

export default function BuscarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const extra = BUSCAR_EXTRA[lang] || BUSCAR_EXTRA.es;
  const calendarRef = useRef(null);
  const navbarRef = useRef(null);
  const filtersRef = useRef(null);
  const [headerOffset, setHeaderOffset] = useState(0);

  const verticalParam = searchParams.get("vertical") || "todo";
  const ciudadParam = searchParams.get("ciudad") || "";
  const fechaBusquedaInicioParam = searchParams.get("desde") || "";
  const fechaBusquedaFinParam = searchParams.get("hasta") || "";

  const [user, setUser] = useState(null);
  const [ciudadInput, setCiudadInput] = useState(ciudadParam);
  const [fechaDesdeInput, setFechaDesdeInput] = useState(fechaBusquedaInicioParam);
  const [fechaHastaInput, setFechaHastaInput] = useState(fechaBusquedaFinParam);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const updateParams = useCallback(
    (vertical, ciudad, desde, hasta) => {
      const params = new URLSearchParams();
      if (vertical && vertical !== "todo") params.set("vertical", vertical);
      if (ciudad?.trim()) params.set("ciudad", ciudad.trim());
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser ?? null);
    });
  }, []);

  useEffect(() => {
    function measureHeaders() {
      const navH = navbarRef.current?.offsetHeight ?? 0;
      const filtH = filtersRef.current?.offsetHeight ?? 0;
      setHeaderOffset(navH + filtH);
    }

    measureHeaders();
    window.addEventListener("resize", measureHeaders);
    return () => window.removeEventListener("resize", measureHeaders);
  }, []);

  useEffect(() => {
    setCiudadInput(ciudadParam);
    setFechaDesdeInput(fechaBusquedaInicioParam);
    setFechaHastaInput(fechaBusquedaFinParam);
  }, [ciudadParam, fechaBusquedaInicioParam, fechaBusquedaFinParam]);

  useEffect(() => {
    if (!calendarOpen) return;

    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError("");
      setHoveredIndex(null);
      setSelectedIndex(null);

      let query = supabase
        .from("services")
        .select(
          `
          id,
          titulo,
          vertical,
          precio,
          cancellation_policy,
          reserva_inmediata,
          descripcion,
          foto_url,
          tipo_alojamiento,
          modalidad,
          location_zone,
          location_lat,
          location_lng,
          ciudad,
          proveedor_id,
          oferta_descuento,
          oferta_valida_hasta,
          disponible_para_viajar,
          profiles!inner (
            nombre,
            apellido,
            verificado,
            idiomas,
            id,
            location_zone,
            ciudad
          )
        `,
        )
        .eq("disponible", true);

      if (verticalParam && verticalParam !== "todo") {
        query = query.eq("vertical", verticalParam);
      }

      if (ciudadParam.trim()) {
        const ciudad = ciudadParam.trim();
        query = query.or(
          `ciudad.ilike.%${ciudad}%,location_zone.ilike.%${ciudad}%`,
        );
      }

      if (fechaBusquedaInicioParam && fechaBusquedaFinParam) {
        const { data: bloqueados } = await supabase
          .from("disponibilidad")
          .select("service_id")
          .lte("fecha_inicio", fechaBusquedaFinParam)
          .gte("fecha_fin", fechaBusquedaInicioParam);

        const idsBloqueados = [
          ...new Set((bloqueados ?? []).map((b) => b.service_id)),
        ];
        if (idsBloqueados.length > 0) {
          query = query.not("id", "in", `(${idsBloqueados.join(",")})`);
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        setResults([]);
      } else {
        const services = data ?? [];
        const proveedorIds = [
          ...new Set(services.map((s) => s.proveedor_id).filter(Boolean)),
        ];

        let avalesByProveedor = {};
        if (proveedorIds.length > 0) {
          const { data: referencias } = await supabase
            .from("referencias")
            .select("proveedor_id")
            .in("proveedor_id", proveedorIds)
            .eq("estado", "completada");

          for (const ref of referencias ?? []) {
            avalesByProveedor[ref.proveedor_id] =
              (avalesByProveedor[ref.proveedor_id] ?? 0) + 1;
          }
        }

        setResults(
          services.map((service) => ({
            ...service,
            avales_count: avalesByProveedor[service.proveedor_id] ?? 0,
          })),
        );
      }

      setLoading(false);
    }

    fetchResults();
  }, [verticalParam, ciudadParam, fechaBusquedaInicioParam, fechaBusquedaFinParam]);

  function handleVerticalChange(vertical) {
    updateParams(vertical, ciudadInput, fechaDesdeInput, fechaHastaInput);
  }

  function handleBuscarSubmit(e) {
    e.preventDefault();
    updateParams(verticalParam, ciudadInput, fechaDesdeInput, fechaHastaInput);
  }

  function handleRangeChange({ desde, hasta }) {
    setFechaDesdeInput(desde);
    setFechaHastaInput(hasta);
  }

  function handleSelect(index) {
    setSelectedIndex(index);
    setHoveredIndex(index);
  }

  const resultCount = results.length;

  const filterTabs = FILTER_TABS.map((tab) => ({
    ...tab,
    label: tab.id === "todo" ? t.hero.todo : t.hero[tab.id],
  }));

  const resultadosLabel =
    resultCount === 1
      ? lang === "en"
        ? "1 result"
        : "1 resultado"
      : `${resultCount} ${t.buscar.resultados}`;

  const fechasDisplay =
    fechaDesdeInput && fechaHastaInput
      ? `${formatShortDate(fechaDesdeInput)} — ${formatShortDate(fechaHastaInput)}`
      : fechaDesdeInput
        ? formatShortDate(fechaDesdeInput)
        : t.hero.annadeFecha;

  const splitHeight =
    headerOffset > 0
      ? `max(600px, calc(100vh - ${headerOffset}px))`
      : "600px";

  return (
    <div
      className="flex flex-col font-sans"
      style={{
        backgroundColor: "#f7f5f2",
        color: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <div ref={navbarRef} className="shrink-0">
        <BuscarNavbar user={user} t={t} extra={extra} />
      </div>

      {/* Barra de filtros */}
      <header
        ref={filtersRef}
        className="shrink-0 border-b"
        style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de", padding: "12px 20px" }}
      >
        <form
          onSubmit={handleBuscarSubmit}
          className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((tab) => {
              const isActive = verticalParam === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleVerticalChange(tab.id)}
                  className="flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={{
                    borderRadius: 9999,
                    borderColor: isActive ? tab.color : "#e8e4de",
                    backgroundColor: isActive ? tab.light : "#fff",
                    color: isActive ? tab.color : "#666",
                  }}
                >
                  {tab.id !== "todo" && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tab.color }}
                      aria-hidden
                    />
                  )}
                  {tab.id === "todo" && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tab.color }}
                      aria-hidden
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            className="hidden h-6 w-px shrink-0 sm:block"
            style={{ backgroundColor: "#e8e4de" }}
            aria-hidden
          />

          <div
            className="flex min-w-[160px] flex-1 items-center gap-2 border px-3 py-2"
            style={{ backgroundColor: "#fff", borderColor: "#e8e4de", borderRadius: 6, maxWidth: 220 }}
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-[#bbb]" />
            <input
              type="text"
              value={ciudadInput}
              onChange={(e) => setCiudadInput(e.target.value)}
              placeholder={t.hero.placeholder}
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#bbb]"
              style={{ color: "#2a3a4a" }}
            />
          </div>

          <div ref={calendarRef} className="relative">
            <button
              type="button"
              onClick={() => setCalendarOpen((o) => !o)}
              className="flex min-w-[160px] items-center border px-3 py-2 text-left"
              style={{ backgroundColor: "#fff", borderColor: "#e8e4de", borderRadius: 6 }}
            >
              <span className="text-[12px]" style={{ color: fechaDesdeInput ? "#2a3a4a" : "#bbb" }}>
                {fechasDisplay}
              </span>
            </button>

            {calendarOpen && (
              <div
                className="absolute left-0 z-50 mt-1 rounded-lg border bg-white p-4 shadow-xl"
                style={{ borderColor: "#e8e4de", minWidth: 320 }}
              >
                <CalendarioRangoFechas
                  fechaInicio={fechaDesdeInput}
                  fechaFin={fechaHastaInput}
                  onChange={handleRangeChange}
                  onRangeComplete={() => setCalendarOpen(false)}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          >
            {t.hero.buscar}
          </button>

          <p className="ml-auto shrink-0 text-[11px]" style={{ color: "#bbb" }}>
            {loading ? (lang === "en" ? "Searching…" : "Buscando…") : resultadosLabel}
          </p>
        </form>
      </header>

      {error && (
        <p className="mx-5 mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Split layout */}
      <div
        className="mx-auto grid w-full max-w-[1600px] min-h-0 grid-cols-1 overflow-hidden md:grid-cols-2"
        style={{
          flex: 1,
          overflow: "hidden",
          minHeight: 600,
          height: splitHeight,
        }}
      >
        {/* Lista */}
        <div
          className="h-full min-h-0 overflow-y-auto border-r [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderColor: "#e8e4de" }}
        >

          {loading && (
            <div className="flex flex-col">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 animate-pulse border-b bg-white/60" style={{ borderColor: "#e8e4de" }} />
              ))}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="px-5 py-10 text-center text-[12px] leading-relaxed text-[#888]">
              {t.buscar.sinResultados}
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="flex flex-col">
              {results.map((service, index) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  index={index}
                  isActive={selectedIndex === index}
                  onHover={setHoveredIndex}
                  onLeave={() => setHoveredIndex(null)}
                  onSelect={handleSelect}
                  extra={extra}
                  t={t}
                  lang={lang}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Mapa estático */}
        <div
          className="relative min-h-0 overflow-hidden"
          style={{ height: "100%", position: "relative" }}
        >
          {!loading && results.length > 0 ? (
            <StaticMap
              results={results}
              hoveredIndex={hoveredIndex}
              selectedIndex={selectedIndex}
              onPinHover={setHoveredIndex}
              onPinLeave={() => setHoveredIndex(null)}
              onPinSelect={handleSelect}
              extra={extra}
              t={t}
            />
          ) : (
            <div
              className="flex items-center justify-center text-[12px]"
              style={{
                height: "100%",
                position: "relative",
                backgroundColor: "#eef2f7",
                color: "#aab4c4",
                backgroundImage: `
                  linear-gradient(rgba(200, 212, 228, 0.45) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(200, 212, 228, 0.45) 1px, transparent 1px)
                `,
                backgroundSize: "28px 28px",
              }}
            >
              {loading ? (lang === "en" ? "Loading map…" : "Cargando mapa…") : t.buscar.sinResultados}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
