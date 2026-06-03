"use client";

import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

function getActiveTabColor(verticalParam) {
  if (verticalParam === "todo") return BRAND.primary;
  return VERTICAL_THEME[verticalParam]?.color ?? BRAND.primary;
}

function formatPricePill(precio, suffix) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio)}€`;
}

function getMarkerCoords(service, index) {
  const madridLat = 40.4168;
  const madridLng = -3.7038;
  const offset = 0.01;

  const lat =
    service.location_lat || madridLat + (index % 5 - 2) * offset;
  const lng =
    service.location_lng ||
    madridLng + (Math.floor(index / 5) % 5 - 2) * offset;

  return [Number(lng), Number(lat)];
}

function MapaResultados({ results, hoveredIndex, onPinHover, onPinLeave }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-3.7038, 40.4168],
      zoom: 11,
      style: "mapbox://styles/mapbox/light-v11",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function clearMarkers() {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
    }

    function addMarkers() {
      clearMarkers();

      results.forEach((service, index) => {
        const profile = service.profiles ?? {};
        const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
        const coords = getMarkerCoords(service, index);
        const price = formatPricePill(service.precio, theme.priceSuffix);
        const providerName =
          formatShortName(profile.nombre, profile.apellido) || "Proveedor";
        const serviceType = service.titulo || theme.label;

        const el = document.createElement("div");
        el.className = "map-price-marker";
        el.style.cssText = `
          background-color: ${theme.color};
          color: #fff;
          padding: 5px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: transform 0.2s ease;
          white-space: nowrap;
        `;
        el.textContent = price;

        const popup = new mapboxgl.Popup({
          offset: 20,
          closeButton: true,
          closeOnClick: false,
        }).setHTML(`
          <div style="font-family: system-ui, sans-serif; padding: 2px 0;">
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: ${theme.color};">${price}</p>
            <p style="margin: 0 0 4px; font-size: 13px; color: #1a1a1a;">${providerName}</p>
            <p style="margin: 0; font-size: 12px; color: #666;">${serviceType}</p>
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("mouseenter", () => onPinHover(index));
        el.addEventListener("mouseleave", onPinLeave);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          map.flyTo({ center: coords, zoom: 14, duration: 800 });
          marker.togglePopup();
        });

        markersRef.current.push({ marker, element: el, index });
      });

      if (results.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        results.forEach((service, index) => {
          bounds.extend(getMarkerCoords(service, index));
        });
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }
    }

    if (map.loaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }

    return clearMarkers;
  }, [results, onPinHover, onPinLeave]);

  useEffect(() => {
    markersRef.current.forEach(({ element, index }) => {
      const isActive = hoveredIndex === index;
      element.style.transform = isActive ? "scale(1.2)" : "scale(1)";
      element.style.zIndex = isActive ? "10" : "1";
    });
  }, [hoveredIndex]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full min-h-[200px] w-full overflow-hidden rounded-xl lg:rounded-none lg:rounded-l-xl"
    />
  );
}

function ServiceCard({ service, index, isHovered, onHover, onLeave }) {
  const router = useRouter();
  const [preguntando, setPreguntando] = useState(false);
  const profile = service.profiles ?? {};
  const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
  const { Icon } = theme;
  const proveedorId = service.proveedor_id || profile.id;
  const zone = getServiceZone(service, profile);
  const subtype = getSubtypeLabel(service);
  const languages = Array.isArray(profile.idiomas) ? profile.idiomas : [];

  async function handlePreguntar() {
    setPreguntando(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPreguntando(false);
      router.push("/login");
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_a_id.eq.${user.id},participant_b_id.eq.${proveedorId}),and(participant_a_id.eq.${proveedorId},participant_b_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existing?.id) {
      router.push(`/chat?conversation=${existing.id}`);
      setPreguntando(false);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .upsert({
        participant_a_id: user.id,
        participant_b_id: proveedorId,
      })
      .select("id")
      .single();

    setPreguntando(false);

    if (error || !created) return;

    router.push(`/chat?conversation=${created.id}`);
  }

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
          <button
            type="button"
            onClick={handlePreguntar}
            disabled={preguntando}
            className="flex-1 rounded-xl border py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            style={{ borderColor: theme.color, color: theme.color }}
          >
            {preguntando ? "…" : "Preguntar 💬"}
          </button>
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
          location_lat,
          location_lng,
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
            <MapaResultados
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
