"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const FILTER_TABS = [
  { id: "todo", label: "Todo" },
  { id: "alojamiento", label: "Alojamiento" },
  { id: "ninos", label: "Niños" },
  { id: "mascotas", label: "Mascotas" },
];

const VERTICAL_THEME = {
  alojamiento: {
    label: "Alojamiento",
    color: "#1d4f91",
    light: "#e8f0fb",
    priceSuffix: "/ noche",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    color: "#0e7a5c",
    light: "#e6f4f0",
    priceSuffix: "/ hora",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    color: "#c47d1a",
    light: "#fdf3e3",
    priceSuffix: "/ día",
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

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function PersonIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function PetIcon({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7" cy="4" r="1.5" /><circle cx="12" cy="3" r="1.5" /><circle cx="17" cy="4" r="1.5" /><circle cx="4.5" cy="8.5" r="1.5" />
      <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
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

function getPinPosition(index) {
  const top = 10 + ((index * 37 + 17) % 62);
  const left = 6 + ((index * 53 + 23) % 72);
  return { top: `${top}%`, left: `${left}%` };
}

function getActiveTabColor(verticalParam) {
  if (verticalParam === "todo") return BRAND.primary;
  return VERTICAL_THEME[verticalParam]?.color ?? BRAND.primary;
}

function SimulatedMap({ results, hoveredIndex, onPinHover, onPinLeave }) {
  return (
    <div
      className="relative h-full min-h-[200px] overflow-hidden rounded-xl lg:rounded-none lg:rounded-l-xl"
      style={{
        backgroundColor: "#e8f0fb",
        backgroundImage: `
          linear-gradient(rgba(29, 79, 145, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(29, 79, 145, 0.06) 1px, transparent 1px),
          linear-gradient(135deg, #e8f0fb 0%, #dce8f8 50%, #e8f0fb 100%)
        `,
        backgroundSize: "32px 32px, 32px 32px, 100% 100%",
      }}
    >
      {results.map((service, index) => {
        const profile = service.profiles ?? {};
        const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
        const zone = getServiceZone(service, profile);
        const pos = getPinPosition(index);
        const isActive = hoveredIndex === index;

        return (
          <button
            key={service.id}
            type="button"
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold shadow-md transition-transform"
            style={{
              top: pos.top,
              left: pos.left,
              backgroundColor: isActive ? theme.color : "#fff",
              color: isActive ? "#fff" : theme.color,
              border: `2px solid ${theme.color}`,
              transform: isActive
                ? "translate(-50%, calc(-50% - 2px)) scale(1.08)"
                : "translate(-50%, -50%)",
            }}
            onMouseEnter={() => onPinHover(index)}
            onMouseLeave={onPinLeave}
          >
            {formatPrice(service.precio, theme.priceSuffix).replace("/ noche", "").replace("/ hora", "").replace("/ día", "")}
            <span className="ml-1 font-normal opacity-80">· {zone}</span>
          </button>
        );
      })}

      <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-[#666]/80">
        Ubicación aproximada · zona/barrio
      </p>
    </div>
  );
}

function ServiceCard({ service, index, isHovered, onHover, onLeave }) {
  const profile = service.profiles ?? {};
  const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
  const { Icon } = theme;
  const proveedorId = service.proveedor_id || profile.id;
  const zone = getServiceZone(service, profile);
  const subtype = getSubtypeLabel(service);
  const languages = Array.isArray(profile.idiomas) ? profile.idiomas : [];

  return (
    <li
      className="overflow-hidden rounded-2xl border bg-white transition-all duration-200 ease-out"
      style={{
        borderColor: isHovered ? theme.color : BRAND.border,
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isHovered ? `0 8px 24px ${theme.color}22` : "0 1px 4px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={onLeave}
    >
      <div className="relative">
        {service.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.foto_url}
            alt={service.titulo || theme.label}
            className="h-[140px] w-full object-cover"
          />
        ) : (
          <div
            className="flex h-[140px] w-full items-center justify-center"
            style={{ backgroundColor: theme.light }}
          >
            <Icon className="h-10 w-10" style={{ color: theme.color }} />
          </div>
        )}

        <span
          className="absolute bottom-[-14px] left-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md"
          style={{ backgroundColor: theme.color }}
        >
          {getInitials(profile.nombre, profile.apellido)}
        </span>
      </div>

      <div className="px-4 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#1a1a1a]">
            {formatShortName(profile.nombre, profile.apellido) || "Proveedor"}
          </p>
          {profile.verificado === true && (
            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              Verificado ✓
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-[#888]">{zone}</p>

        {service.titulo && (
          <p className="mt-1 text-sm text-[#444]">{service.titulo}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {subtype && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: theme.light, color: theme.color }}
            >
              {subtype}
            </span>
          )}
          {service.reserva_inmediata ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
              Inmediata ⚡
            </span>
          ) : (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
              Con confirmación 🕐
            </span>
          )}
        </div>

        <p className="mt-2 text-xl font-bold" style={{ color: theme.color }}>
          {formatPrice(service.precio, theme.priceSuffix)}
        </p>

        {languages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {languages.map((lang) => (
              <span
                key={lang}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[#666]"
                style={{ backgroundColor: BRAND.warm }}
              >
                {lang}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link
            href={`/proveedor/${proveedorId}`}
            className="flex-1 rounded-xl border py-2.5 text-center text-sm font-semibold no-underline transition-opacity hover:opacity-90"
            style={{ borderColor: theme.color, color: theme.color }}
          >
            Ver perfil
          </Link>
          <Link
            href={`/reservar/${service.id}`}
            className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.color }}
          >
            Reservar
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function BuscarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const verticalParam = searchParams.get("vertical") || "todo";
  const ciudadParam = searchParams.get("ciudad") || "";

  const [ciudadInput, setCiudadInput] = useState(ciudadParam);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const updateParams = useCallback(
    (vertical, ciudad) => {
      const params = new URLSearchParams();
      if (vertical && vertical !== "todo") params.set("vertical", vertical);
      if (ciudad?.trim()) params.set("ciudad", ciudad.trim());
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  useEffect(() => {
    setCiudadInput(ciudadParam);
  }, [ciudadParam]);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError("");
      setHoveredIndex(null);

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
          foto_url,
          tipo_alojamiento,
          modalidad,
          location_zone,
          ciudad,
          proveedor_id,
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
        query = query.ilike("ciudad", `%${ciudadParam.trim()}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        setResults([]);
      } else {
        setResults(data ?? []);
      }

      setLoading(false);
    }

    fetchResults();
  }, [verticalParam, ciudadParam]);

  function handleVerticalChange(vertical) {
    updateParams(vertical, ciudadInput);
  }

  function handleCiudadSubmit(e) {
    e.preventDefault();
    updateParams(verticalParam, ciudadInput);
  }

  const activeTabColor = getActiveTabColor(verticalParam);
  const resultCount = results.length;

  return (
    <div className="flex min-h-screen flex-col font-sans" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
      <Navbar />

      {/* Header filtros */}
      <header
        className="shrink-0 border-b bg-white px-4 py-4 sm:px-6"
        style={{ borderColor: BRAND.border }}
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => {
              const isActive = verticalParam === tab.id;
              const tabColor =
                tab.id === "todo"
                  ? BRAND.primary
                  : VERTICAL_THEME[tab.id]?.color ?? BRAND.primary;
              const tabLight =
                tab.id === "todo"
                  ? BRAND.light
                  : VERTICAL_THEME[tab.id]?.light ?? BRAND.light;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleVerticalChange(tab.id)}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor: isActive ? tabColor : BRAND.border,
                    backgroundColor: isActive ? tabLight : "#fff",
                    color: isActive ? tabColor : "#444",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCiudadSubmit} className="flex w-full gap-2 lg:max-w-md">
            <input
              type="text"
              value={ciudadInput}
              onChange={(e) => setCiudadInput(e.target.value)}
              placeholder="Ciudad, barrio o zona…"
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: activeTabColor }}
            >
              Buscar
            </button>
          </form>
        </div>

        <p className="mx-auto mt-3 max-w-[1600px] text-xs text-[#888]">
          {loading
            ? "Buscando proveedores…"
            : resultCount === 1
              ? "1 resultado encontrado"
              : `${resultCount} resultados encontrados`}
        </p>
      </header>

      {error && (
        <p className="mx-4 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      )}

      {/* Split layout */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        {/* Mapa — móvil 200px, desktop 45% */}
        <div className="h-[200px] shrink-0 lg:h-auto lg:w-[45%] lg:min-h-[calc(100vh-180px)] lg:p-4 lg:pr-2">
          {!loading && results.length > 0 ? (
            <SimulatedMap
              results={results}
              hoveredIndex={hoveredIndex}
              onPinHover={setHoveredIndex}
              onPinLeave={() => setHoveredIndex(null)}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center rounded-xl text-sm text-[#888] lg:rounded-l-xl"
              style={{
                backgroundColor: "#e8f0fb",
                backgroundImage: `
                  linear-gradient(rgba(29, 79, 145, 0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(29, 79, 145, 0.06) 1px, transparent 1px)
                `,
                backgroundSize: "32px 32px",
              }}
            >
              {loading ? "Cargando mapa…" : "Sin resultados en el mapa"}
            </div>
          )}
        </div>

        {/* Lista — 55% scrolleable */}
        <div className="flex-1 overflow-y-auto lg:w-[55%] lg:max-h-[calc(100vh-180px)] lg:p-4 lg:pl-2">
          {loading && (
            <div className="flex flex-col gap-4 p-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-72 animate-pulse rounded-2xl bg-white/80" />
              ))}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <p
              className="m-4 rounded-2xl border bg-white px-6 py-10 text-center text-sm leading-relaxed text-[#666]"
              style={{ borderColor: BRAND.border }}
            >
              No encontramos proveedores en esta zona todavía. Estamos creciendo
              cada semana.
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="flex flex-col gap-4 p-4 pt-2 lg:pt-0">
              {results.map((service, index) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  index={index}
                  isHovered={hoveredIndex === index}
                  onHover={setHoveredIndex}
                  onLeave={() => setHoveredIndex(null)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
