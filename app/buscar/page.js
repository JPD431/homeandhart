"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import CiudadAutocompleteInput from "@/app/components/CiudadAutocompleteInput";
import { formatShortDate } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "@/app/components/brand";
import { serviceMeetsCapacidadMin } from "@/app/lib/capacidad";
import ServiceCard from "@/app/components/ServiceCard";
import {
  formatServiceCardShortName,
  normalizeServiceProfile,
  serviceDescriptionIsPetFriendly,
} from "@/app/lib/service-card-display";
import { supabase } from "@/app/lib/supabase";

const RealMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#eef2f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        color: "#888",
      }}
    >
      Cargando mapa...
    </div>
  ),
});

const FILTER_TABS = [
  { id: "todo", color: "#1d4f91", light: "#e8f0fb" },
  { id: "alojamiento", color: "#1d4f91", light: "#e8f0fb" },
  { id: "ninos", color: "#0e7a5c", light: "#e6f4f0" },
  { id: "mascotas", color: "#c47d1a", light: "#fdf3e3" },
];

const getColor = (vertical) =>
  vertical === "alojamiento" ? "#1d4f91" : vertical === "ninos" ? "#0e7a5c" : "#c47d1a";

const getLightColor = (vertical) =>
  vertical === "alojamiento" ? "#e8f0fb" : vertical === "ninos" ? "#e6f4f0" : "#fdf3e3";

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

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

const IDIOMAS_OPTIONS = [
  "Español",
  "English",
  "Français",
  "Deutsch",
  "Italiano",
  "Português",
  "中文",
];

const ORDEN_OPTIONS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio_asc", label: "Precio ↑" },
  { value: "precio_desc", label: "Precio ↓" },
  { value: "valoracion", label: "Mejor valorado" },
  { value: "mas_reservado", label: "Más reservado" },
];

const VALORACION_PILLS = [
  { value: 0, label: "Todas" },
  { value: 4, label: "4+" },
  { value: 4.5, label: "4.5+" },
  { value: 5, label: "5" },
];

const TIPO_ALOJAMIENTO_FILTER = [
  { value: "", label: "Todos" },
  { value: "completo", label: "Entero" },
  { value: "habitacion_privada", label: "Hab. privada" },
  { value: "habitacion_compartida", label: "Compartida" },
];

const EDAD_NINOS_OPTIONS = ["0-1", "1-3", "3-6", "6-12"];

function getDefaultFilters() {
  return {
    precioMin: 0,
    precioMax: 500,
    valoracionMin: 0,
    soloInmediata: false,
    soloConDocumentos: false,
    idiomas: [],
    petFriendly: false,
    tipoAlojamiento: "",
    capacidadMin: 1,
    disponibleViajar: false,
    edadNinos: [],
    conJardin: false,
    paseosIncluidos: false,
  };
}

function filtersFromSearchParams(searchParams) {
  const defaults = getDefaultFilters();
  return {
    ...defaults,
    precioMin: parseInt(searchParams.get("precioMin") || "0", 10) || 0,
    precioMax: parseInt(searchParams.get("precioMax") || "500", 10) || 500,
    valoracionMin: parseFloat(searchParams.get("valoracion") || "0") || 0,
    soloInmediata: searchParams.get("inmediata") === "1",
    soloConDocumentos: searchParams.get("documentos") === "1",
    idiomas: searchParams.get("idiomas")?.split(",").filter(Boolean) || [],
    petFriendly: searchParams.get("pet") === "1",
    tipoAlojamiento: searchParams.get("tipo") || "",
    capacidadMin: parseInt(searchParams.get("capacidad") || "1", 10) || 1,
    disponibleViajar: searchParams.get("viajar") === "1",
    edadNinos: searchParams.get("edades")?.split(",").filter(Boolean) || [],
    conJardin: searchParams.get("jardin") === "1",
    paseosIncluidos: searchParams.get("paseos") === "1",
  };
}

function buildBuscarQueryString({
  vertical,
  ciudad,
  desde,
  hasta,
  filters,
  ordenarPor,
  bundle,
  origen,
}) {
  const params = new URLSearchParams();
  if (vertical && vertical !== "todo") params.set("vertical", vertical);
  if (ciudad?.trim()) params.set("ciudad", ciudad.trim());
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (filters.precioMin > 0) params.set("precioMin", String(filters.precioMin));
  if (filters.precioMax < 500) params.set("precioMax", String(filters.precioMax));
  if (filters.valoracionMin > 0) params.set("valoracion", String(filters.valoracionMin));
  if (filters.soloInmediata) params.set("inmediata", "1");
  if (filters.soloConDocumentos) params.set("documentos", "1");
  if (filters.idiomas.length > 0) params.set("idiomas", filters.idiomas.join(","));
  if (filters.petFriendly) params.set("pet", "1");
  if (filters.tipoAlojamiento) params.set("tipo", filters.tipoAlojamiento);
  if (filters.capacidadMin > 1) params.set("capacidad", String(filters.capacidadMin));
  if (filters.disponibleViajar) params.set("viajar", "1");
  if (filters.edadNinos.length > 0) params.set("edades", filters.edadNinos.join(","));
  if (filters.conJardin) params.set("jardin", "1");
  if (filters.paseosIncluidos) params.set("paseos", "1");
  if (ordenarPor && ordenarPor !== "relevancia") params.set("orden", ordenarPor);
  if (bundle) {
    params.set("bundle", "true");
    if (origen) params.set("origen", origen);
  }
  return params.toString();
}

function countActiveFilters(filters, vertical) {
  let n = 0;
  if (filters.precioMin > 0) n++;
  if (filters.precioMax < 500) n++;
  if (filters.valoracionMin > 0) n++;
  if (filters.soloInmediata) n++;
  if (filters.soloConDocumentos) n++;
  if (filters.idiomas.length > 0) n++;
  if (vertical === "alojamiento" || vertical === "todo") {
    if (filters.petFriendly) n++;
    if (filters.tipoAlojamiento) n++;
    if (filters.capacidadMin > 1) n++;
  }
  if (vertical === "ninos" || vertical === "todo") {
    if (filters.disponibleViajar) n++;
    if (filters.edadNinos.length > 0) n++;
  }
  if (vertical === "mascotas" || vertical === "todo") {
    if (filters.conJardin) n++;
    if (filters.paseosIncluidos) n++;
  }
  return n;
}

function hasSearchCriteriaApplied({
  vertical,
  ciudad,
  desde,
  hasta,
  orden,
  filters,
}) {
  return (
    vertical !== "todo" ||
    ciudad.trim() !== "" ||
    desde !== "" ||
    hasta !== "" ||
    orden !== "relevancia" ||
    countActiveFilters(filters, vertical) > 0
  );
}

function hasDocuments(profile) {
  return profile?.documentos_completos === true;
}

function matchesEdadNinos(descripcion, ranges) {
  if (!ranges.length) return true;
  const desc = (descripcion || "").toLowerCase();
  const keywords = {
    "0-1": ["bebé", "bebe", "0-1", "lactante"],
    "1-3": ["1-3", "pequeño", "pequeno", "infantil"],
    "3-6": ["3-6", "preescolar", "infancia"],
    "6-12": ["6-12", "escolar", "niños mayores", "ninos mayores"],
  };
  return ranges.some((range) =>
    (keywords[range] || []).some((kw) => desc.includes(kw)),
  );
}

function matchesClientFilters(service, filters, avgRating) {
  const profile = normalizeServiceProfile(service);

  if (filters.soloConDocumentos && !hasDocuments(profile)) return false;

  if (filters.valoracionMin > 0) {
    if (!avgRating || avgRating < filters.valoracionMin) return false;
  }

  if (filters.idiomas.length > 0) {
    const langs = Array.isArray(profile.idiomas) ? profile.idiomas : [];
    if (!filters.idiomas.some((l) => langs.includes(l))) return false;
  }

  if (filters.petFriendly && service.vertical === "alojamiento") {
    if (!serviceDescriptionIsPetFriendly(service)) return false;
  }

  if (!serviceMeetsCapacidadMin(service, filters.capacidadMin)) {
    return false;
  }

  if (filters.disponibleViajar && service.vertical === "ninos") {
    if (service.disponible_para_viajar !== true) return false;
  }

  if (filters.edadNinos.length > 0 && service.vertical === "ninos") {
    if (!matchesEdadNinos(service.descripcion, filters.edadNinos)) return false;
  }

  if (filters.conJardin && service.vertical === "mascotas") {
    const desc = (service.descripcion || "").toLowerCase();
    if (service.jardin !== true && !desc.includes("jardín") && !desc.includes("jardin")) {
      return false;
    }
  }

  if (filters.paseosIncluidos && service.vertical === "mascotas") {
    const desc = (service.descripcion || "").toLowerCase();
    if (
      service.paseos_incluidos !== true &&
      !desc.includes("paseo") &&
      !desc.includes("paseos")
    ) {
      return false;
    }
  }

  return true;
}

function sortServices(services, ordenarPor, ratingsByProveedor, bookingsByService) {
  const list = [...services];

  if (ordenarPor === "precio_asc") {
    return list.sort((a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0));
  }
  if (ordenarPor === "precio_desc") {
    return list.sort((a, b) => (Number(b.precio) || 0) - (Number(a.precio) || 0));
  }
  if (ordenarPor === "valoracion") {
    return list.sort(
      (a, b) =>
        (ratingsByProveedor[b.proveedor_id]?.avg || 0) -
        (ratingsByProveedor[a.proveedor_id]?.avg || 0),
    );
  }
  if (ordenarPor === "mas_reservado") {
    return list.sort(
      (a, b) => (bookingsByService[b.id] || 0) - (bookingsByService[a.id] || 0),
    );
  }

  return list.sort((a, b) => {
    const avA = ratingsByProveedor[a.proveedor_id]?.avg || 0;
    const avB = ratingsByProveedor[b.proveedor_id]?.avg || 0;
    if (avB !== avA) return avB - avA;
    return (b.avales_count || 0) - (a.avales_count || 0);
  });
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-[#444]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? PRIMARY : "#d1d5db" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }}
        />
      </button>
    </label>
  );
}

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

function BuscarContent() {
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
  const bundleMode = searchParams.get("bundle") === "true";
  const origenParam = searchParams.get("origen") || "";

  const [user, setUser] = useState(null);
  const [origenService, setOrigenService] = useState(null);
  const [ciudadInput, setCiudadInput] = useState(ciudadParam);
  const [fechaDesdeInput, setFechaDesdeInput] = useState(fechaBusquedaInicioParam);
  const [fechaHastaInput, setFechaHastaInput] = useState(fechaBusquedaFinParam);
  const [rawResults, setRawResults] = useState([]);
  const [ratingsByProveedor, setRatingsByProveedor] = useState({});
  const [bookingsByService, setBookingsByService] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(getDefaultFilters);
  const [comparando, setComparando] = useState([]);
  const [favoritos, setFavoritos] = useState([]);

  const appliedFilters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const ordenarPor = searchParams.get("orden") || "relevancia";

  const replaceSearchParams = useCallback(
    ({
      vertical = verticalParam,
      ciudad = ciudadInput,
      desde = fechaDesdeInput,
      hasta = fechaHastaInput,
      filters = appliedFilters,
      ordenar = ordenarPor,
    } = {}) => {
      const query = buildBuscarQueryString({
        vertical,
        ciudad,
        desde,
        hasta,
        filters,
        ordenarPor: ordenar,
        bundle: searchParams.get("bundle") === "true",
        origen: searchParams.get("origen") || "",
      });
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [
      appliedFilters,
      ciudadInput,
      fechaDesdeInput,
      fechaHastaInput,
      ordenarPor,
      pathname,
      router,
      searchParams,
      verticalParam,
    ],
  );

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser ?? null);
      if (authUser) {
        const { data } = await supabase
          .from("favoritos")
          .select("proveedor_id")
          .eq("cliente_id", authUser.id);
        setFavoritos((data ?? []).map((f) => f.proveedor_id));
      } else {
        setFavoritos([]);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!bundleMode || !origenParam) {
      setOrigenService(null);
      return;
    }

    async function loadOrigen() {
      const { data } = await supabase
        .from("services")
        .select(
          `
          id,
          titulo,
          profiles_public (
            nombre,
            apellido
          )
        `,
        )
        .eq("id", origenParam)
        .single();

      setOrigenService(data ?? null);
    }

    loadOrigen();
  }, [bundleMode, origenParam]);

  function handleBundleAdd(serviceIdToAdd) {
    if (!origenParam) return;
    router.push(`/reservar/${origenParam}?bundle_add=${serviceIdToAdd}`);
  }

  useEffect(() => {
    function measureHeaders() {
      const navH = navbarRef.current?.offsetHeight ?? 0;
      const filtH = filtersRef.current?.offsetHeight ?? 0;
      setHeaderOffset(navH + filtH);
    }

    measureHeaders();
    window.addEventListener("resize", measureHeaders);
    return () => window.removeEventListener("resize", measureHeaders);
  }, [advancedOpen]);

  useEffect(() => {
    setCiudadInput(ciudadParam);
    setFechaDesdeInput(fechaBusquedaInicioParam);
    setFechaHastaInput(fechaBusquedaFinParam);
    if (!advancedOpen) {
      setDraftFilters(filtersFromSearchParams(searchParams));
    }
  }, [
    ciudadParam,
    fechaBusquedaInicioParam,
    fechaBusquedaFinParam,
    searchParams,
    advancedOpen,
  ]);

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

      const f = appliedFilters;

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
          capacidad,
          profiles_public!inner (
            nombre,
            apellido,
            verificado,
            badge_respuesta,
            idiomas,
            id,
            location_zone,
            ciudad,
            documentos_completos
          )
        `,
        )
        .eq("disponible", true)
        .or("revision_estado.is.null,revision_estado.neq.borrador")
        .eq("profiles_public.verificado", true);

      if (verticalParam && verticalParam !== "todo") {
        query = query.eq("vertical", verticalParam);
      }

      if (ciudadParam.trim()) {
        const ciudad = ciudadParam.trim();
        query = query.or(
          `ciudad.ilike.%${ciudad}%,location_zone.ilike.%${ciudad}%`,
        );
      }

      if (f.precioMin > 0) {
        query = query.gte("precio", f.precioMin);
      }
      if (f.precioMax < 500) {
        query = query.lte("precio", f.precioMax);
      }
      if (f.soloInmediata) {
        query = query.eq("reserva_inmediata", true);
      }
      if (f.tipoAlojamiento) {
        query = query.eq("tipo_alojamiento", f.tipoAlojamiento);
      }
      if (f.disponibleViajar && (verticalParam === "ninos" || verticalParam === "todo")) {
        query = query.eq("disponible_para_viajar", true);
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
        setRawResults([]);
        setRatingsByProveedor({});
        setBookingsByService({});
      } else {
        const services = data ?? [];
        const proveedorIds = [
          ...new Set(services.map((s) => s.proveedor_id).filter(Boolean)),
        ];
        const serviceIds = services.map((s) => s.id).filter(Boolean);

        let avalesByProveedor = {};
        if (proveedorIds.length > 0) {
          const { data: referencias } = await supabase
            .from("referencias_public")
            .select("proveedor_id")
            .in("proveedor_id", proveedorIds);

          for (const ref of referencias ?? []) {
            avalesByProveedor[ref.proveedor_id] =
              (avalesByProveedor[ref.proveedor_id] ?? 0) + 1;
          }
        }

        const ratingsMap = {};
        if (proveedorIds.length > 0) {
          const { data: reviews } = await supabase
            .from("reviews")
            .select("proveedor_id, valoracion")
            .in("proveedor_id", proveedorIds);

          for (const rev of reviews ?? []) {
            if (!ratingsMap[rev.proveedor_id]) {
              ratingsMap[rev.proveedor_id] = { sum: 0, count: 0 };
            }
            ratingsMap[rev.proveedor_id].sum += Number(rev.valoracion) || 0;
            ratingsMap[rev.proveedor_id].count += 1;
          }
          for (const pid of Object.keys(ratingsMap)) {
            const { sum, count } = ratingsMap[pid];
            ratingsMap[pid].avg = count > 0 ? sum / count : 0;
          }
        }

        const bookingsMap = {};
        if (serviceIds.length > 0) {
          const { data: bookings } = await supabase
            .from("bookings")
            .select("service_id")
            .in("service_id", serviceIds)
            .eq("estado", "completada");

          for (const b of bookings ?? []) {
            bookingsMap[b.service_id] = (bookingsMap[b.service_id] ?? 0) + 1;
          }
        }

        setRatingsByProveedor(ratingsMap);
        setBookingsByService(bookingsMap);
        setRawResults(
          services.map((service) => ({
            ...service,
            avales_count: avalesByProveedor[service.proveedor_id] ?? 0,
          })),
        );
      }

      setLoading(false);
    }

    fetchResults();
  }, [
    verticalParam,
    ciudadParam,
    fechaBusquedaInicioParam,
    fechaBusquedaFinParam,
    appliedFilters,
  ]);

  const results = useMemo(() => {
    const filtered = rawResults.filter((service) => {
      const avg = ratingsByProveedor[service.proveedor_id]?.avg;
      return matchesClientFilters(service, appliedFilters, avg);
    });
    return sortServices(filtered, ordenarPor, ratingsByProveedor, bookingsByService);
  }, [rawResults, appliedFilters, ordenarPor, ratingsByProveedor, bookingsByService]);

  function handleVerticalChange(vertical) {
    replaceSearchParams({
      vertical,
      ciudad: ciudadParam,
      desde: fechaBusquedaInicioParam,
      hasta: fechaBusquedaFinParam,
    });
  }

  function handleBuscarSubmit(e) {
    e.preventDefault();
    replaceSearchParams({
      ciudad: ciudadInput,
      desde: fechaDesdeInput,
      hasta: fechaHastaInput,
      filters: draftFilters,
    });
  }

  function handleRangeChange({ desde, hasta }) {
    setFechaDesdeInput(desde);
    setFechaHastaInput(hasta);
  }

  function handleSelect(index) {
    setSelectedIndex(index);
    setHoveredIndex(index);
  }

  function toggleComparar(service) {
    setComparando((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) return prev.filter((s) => s.id !== service.id);
      if (prev.length >= 3) return prev;
      const profile = normalizeServiceProfile(service);
      return [
        ...prev,
        {
          id: service.id,
          titulo:
            service.titulo ||
            formatServiceCardShortName(profile.nombre, profile.apellido) ||
            "Servicio",
          vertical: service.vertical,
        },
      ];
    });
  }

  function quitarComparar(id) {
    setComparando((prev) => prev.filter((s) => s.id !== id));
  }

  function updateDraft(key, value) {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDraftIdioma(idioma) {
    setDraftFilters((prev) => {
      const has = prev.idiomas.includes(idioma);
      return {
        ...prev,
        idiomas: has
          ? prev.idiomas.filter((l) => l !== idioma)
          : [...prev.idiomas, idioma],
      };
    });
  }

  function toggleDraftEdad(edad) {
    setDraftFilters((prev) => {
      const has = prev.edadNinos.includes(edad);
      return {
        ...prev,
        edadNinos: has
          ? prev.edadNinos.filter((e) => e !== edad)
          : [...prev.edadNinos, edad],
      };
    });
  }

  function handleClearFechas(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setFechaDesdeInput("");
    setFechaHastaInput("");
  }

  function handleClearAll() {
    const defaults = getDefaultFilters();
    setCiudadInput("");
    setFechaDesdeInput("");
    setFechaHastaInput("");
    setDraftFilters(defaults);
    setAdvancedOpen(false);
    replaceSearchParams({
      vertical: "todo",
      ciudad: "",
      desde: "",
      hasta: "",
      filters: defaults,
      ordenar: "relevancia",
    });
  }

  function handleApplyFilters() {
    replaceSearchParams({ filters: { ...draftFilters } });
    setAdvancedOpen(false);
  }

  function handleClearFilters() {
    const defaults = getDefaultFilters();
    setDraftFilters(defaults);
    replaceSearchParams({ filters: defaults, ordenar: "relevancia" });
  }

  const activeFilterCount = countActiveFilters(appliedFilters, verticalParam);

  const showClearAll =
    hasSearchCriteriaApplied({
      vertical: verticalParam,
      ciudad: ciudadParam,
      desde: fechaBusquedaInicioParam,
      hasta: fechaBusquedaFinParam,
      orden: ordenarPor,
      filters: appliedFilters,
    }) ||
    ciudadInput.trim() !== "" ||
    fechaDesdeInput !== "" ||
    fechaHastaInput !== "";

  const hasFechasDraft = Boolean(fechaDesdeInput || fechaHastaInput);

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

  const origenLabel = origenService
    ? origenService.titulo ||
      formatServiceCardShortName(
        origenService.profiles_public?.nombre,
        origenService.profiles_public?.apellido,
      ) ||
      "tu reserva"
    : "tu reserva";

  const bundleFechasLabel =
    fechaBusquedaInicioParam && fechaBusquedaFinParam
      ? `${formatShortDate(fechaBusquedaInicioParam)} — ${formatShortDate(fechaBusquedaFinParam)}`
      : fechaBusquedaInicioParam
        ? formatShortDate(fechaBusquedaInicioParam)
        : fechasDisplay;

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
        paddingBottom: comparando.length > 0 ? 80 : 0,
      }}
    >
      <div ref={navbarRef} className="shrink-0">
        <BuscarNavbar user={user} t={t} extra={extra} />
      </div>

      {bundleMode && (
        <div
          className="shrink-0 border-b px-5 py-3 text-center text-[12px] font-medium"
          style={{ backgroundColor: "#e8f0fb", borderColor: "#e8e4de", color: "#1d4f91" }}
        >
          🔗 Estás añadiendo servicios a tu reserva de {origenLabel} · {bundleFechasLabel}
        </div>
      )}

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
            <span
              className="flex shrink-0 items-center"
              style={{ padding: 4 }}
              aria-hidden
            >
              <SearchIcon className="h-3.5 w-3.5 text-[#bbb]" />
            </span>
            <CiudadAutocompleteInput
              value={ciudadInput}
              onChange={setCiudadInput}
              placeholder={t.hero.placeholder}
              className="min-w-0 flex-1"
              inputClassName="w-full bg-transparent text-[12px] outline-none placeholder:text-[#bbb]"
            />
          </div>

          <div ref={calendarRef} className="relative">
            <div
              className="flex min-w-[160px] items-center border"
              style={{ backgroundColor: "#fff", borderColor: "#e8e4de", borderRadius: 6 }}
            >
              <button
                type="button"
                onClick={() => setCalendarOpen((o) => !o)}
                className="min-w-0 flex-1 px-3 py-2 text-left"
              >
                <span
                  className="text-[12px]"
                  style={{ color: fechaDesdeInput ? "#2a3a4a" : "#bbb" }}
                >
                  {fechasDisplay}
                </span>
              </button>
              {hasFechasDraft && (
                <button
                  type="button"
                  onClick={handleClearFechas}
                  className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] leading-none transition-colors hover:bg-[#f7f5f2]"
                  style={{ color: "#888" }}
                  aria-label={lang === "en" ? "Clear dates" : "Borrar fechas"}
                  title={lang === "en" ? "Clear dates" : "Borrar fechas"}
                >
                  ×
                </button>
              )}
            </div>

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
                  onClear={handleClearFechas}
                  clearLabel={lang === "en" ? "Clear dates" : "Borrar fechas"}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="min-h-[40px] shrink-0 px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 md:px-5 md:text-[13px]"
            style={{ backgroundColor: PRIMARY, borderRadius: 6 }}
          >
            {t.hero.buscar}
          </button>

          {showClearAll && (
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-[40px] shrink-0 border px-3 py-2 text-[12px] font-medium transition-colors hover:bg-[#f7f5f2] md:px-4"
              style={{ borderColor: BORDER, borderRadius: 6, color: "#666" }}
            >
              {lang === "en" ? "Clear" : "Limpiar"}
            </button>
          )}

          <div
            className="hidden h-6 w-px shrink-0 md:block"
            style={{ backgroundColor: BORDER }}
            aria-hidden
          />

          <label className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-[#888]">
              {lang === "en" ? "Sort" : "Ordenar"}
            </span>
            <select
              value={ordenarPor}
              onChange={(e) => replaceSearchParams({ ordenar: e.target.value })}
              className="border px-2.5 py-1.5 text-[11px] outline-none"
              style={{
                backgroundColor: "#fff",
                borderColor: BORDER,
                borderRadius: 6,
                color: "#2a3a4a",
              }}
            >
              {ORDEN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              if (!advancedOpen) setDraftFilters({ ...appliedFilters });
              setAdvancedOpen((o) => !o);
            }}
            className="relative flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: advancedOpen ? "#e8f0fb" : "#fff",
              borderColor: advancedOpen ? PRIMARY : BORDER,
              borderRadius: 6,
              color: advancedOpen ? PRIMARY : "#666",
            }}
          >
            {lang === "en" ? "More filters" : "Más filtros"}
            <span aria-hidden>{advancedOpen ? "▴" : "▾"}</span>
            {activeFilterCount > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <p className="ml-auto shrink-0 text-[11px]" style={{ color: "#bbb" }}>
            {loading ? (lang === "en" ? "Searching…" : "Buscando…") : resultadosLabel}
          </p>
        </form>

        {advancedOpen && (
          <div
            className="mx-auto mt-3 max-w-[1600px] border"
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              borderColor: BORDER,
              padding: 16,
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Precio */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Precio (€)
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={draftFilters.precioMax}
                    value={draftFilters.precioMin}
                    onChange={(e) =>
                      updateDraft("precioMin", Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full border px-2 py-1.5 text-[12px] outline-none"
                    style={{ borderColor: BORDER, borderRadius: 6 }}
                    placeholder="Mín"
                  />
                  <span className="text-[#bbb]">—</span>
                  <input
                    type="number"
                    min={draftFilters.precioMin}
                    max={500}
                    value={draftFilters.precioMax}
                    onChange={(e) =>
                      updateDraft(
                        "precioMax",
                        Math.min(500, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="w-full border px-2 py-1.5 text-[12px] outline-none"
                    style={{ borderColor: BORDER, borderRadius: 6 }}
                    placeholder="Máx"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  value={draftFilters.precioMax}
                  onChange={(e) => updateDraft("precioMax", Number(e.target.value))}
                  className="mt-2 w-full accent-[#1d4f91]"
                />
              </section>

              {/* Valoración */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Valoración
                </h3>
                <div className="flex flex-wrap gap-2">
                  {VALORACION_PILLS.map((pill) => {
                    const active = draftFilters.valoracionMin === pill.value;
                    return (
                      <button
                        key={pill.label}
                        type="button"
                        onClick={() => updateDraft("valoracionMin", pill.value)}
                        className="border px-3 py-1 text-[11px] font-medium transition-colors"
                        style={{
                          borderRadius: 9999,
                          borderColor: active ? PRIMARY : BORDER,
                          backgroundColor: active ? "#e8f0fb" : "#fff",
                          color: active ? PRIMARY : "#666",
                        }}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Disponibilidad y verificación */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Disponibilidad
                </h3>
                <div className="space-y-0.5">
                  <ToggleRow
                    label="Solo reserva inmediata ⚡"
                    checked={draftFilters.soloInmediata}
                    onChange={(v) => updateDraft("soloInmediata", v)}
                  />
                  <ToggleRow
                    label="Con documentos"
                    checked={draftFilters.soloConDocumentos}
                    onChange={(v) => updateDraft("soloConDocumentos", v)}
                  />
                </div>
              </section>

              {/* Idiomas */}
              <section className="sm:col-span-2 lg:col-span-3">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Idiomas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {IDIOMAS_OPTIONS.map((idioma) => {
                    const active = draftFilters.idiomas.includes(idioma);
                    return (
                      <button
                        key={idioma}
                        type="button"
                        onClick={() => toggleDraftIdioma(idioma)}
                        className="border px-3 py-1 text-[11px] font-medium transition-colors"
                        style={{
                          borderRadius: 9999,
                          borderColor: active ? PRIMARY : BORDER,
                          backgroundColor: active ? "#e8f0fb" : "#fff",
                          color: active ? PRIMARY : "#666",
                        }}
                      >
                        {idioma}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Específicos alojamiento */}
              {(verticalParam === "alojamiento" || verticalParam === "todo") && (
                <section className="sm:col-span-2 lg:col-span-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                    Alojamiento
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ToggleRow
                      label="Pet-friendly"
                      checked={draftFilters.petFriendly}
                      onChange={(v) => updateDraft("petFriendly", v)}
                    />
                    <div>
                      <p className="mb-1.5 text-[11px] text-[#666]">Tipo</p>
                      <div className="flex flex-wrap gap-2">
                        {TIPO_ALOJAMIENTO_FILTER.map((tipo) => {
                          const active = draftFilters.tipoAlojamiento === tipo.value;
                          return (
                            <button
                              key={tipo.label}
                              type="button"
                              onClick={() => updateDraft("tipoAlojamiento", tipo.value)}
                              className="border px-3 py-1 text-[11px] font-medium transition-colors"
                              style={{
                                borderRadius: 9999,
                                borderColor: active ? PRIMARY : BORDER,
                                backgroundColor: active ? "#e8f0fb" : "#fff",
                                color: active ? PRIMARY : "#666",
                              }}
                            >
                              {tipo.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] text-[#666]">Capacidad mín. (personas)</p>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={draftFilters.capacidadMin}
                        onChange={(e) =>
                          updateDraft("capacidadMin", Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full border px-2 py-1.5 text-[12px] outline-none"
                        style={{ borderColor: BORDER, borderRadius: 6 }}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Específicos niñera */}
              {(verticalParam === "ninos" || verticalParam === "todo") && (
                <section className="sm:col-span-2 lg:col-span-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                    Niñera
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ToggleRow
                      label="Disponible para viajar"
                      checked={draftFilters.disponibleViajar}
                      onChange={(v) => updateDraft("disponibleViajar", v)}
                    />
                    <div>
                      <p className="mb-1.5 text-[11px] text-[#666]">Edad de los niños</p>
                      <div className="flex flex-wrap gap-2">
                        {EDAD_NINOS_OPTIONS.map((edad) => {
                          const active = draftFilters.edadNinos.includes(edad);
                          return (
                            <button
                              key={edad}
                              type="button"
                              onClick={() => toggleDraftEdad(edad)}
                              className="border px-3 py-1 text-[11px] font-medium transition-colors"
                              style={{
                                borderRadius: 9999,
                                borderColor: active ? "#0e7a5c" : BORDER,
                                backgroundColor: active ? "#e6f5ef" : "#fff",
                                color: active ? "#0e7a5c" : "#666",
                              }}
                            >
                              {edad} años
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Específicos mascotas */}
              {(verticalParam === "mascotas" || verticalParam === "todo") && (
                <section className="sm:col-span-2 lg:col-span-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                    Mascotas
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ToggleRow
                      label="Con jardín"
                      checked={draftFilters.conJardin}
                      onChange={(v) => updateDraft("conJardin", v)}
                    />
                    <ToggleRow
                      label="Paseos incluidos"
                      checked={draftFilters.paseosIncluidos}
                      onChange={(v) => updateDraft("paseosIncluidos", v)}
                    />
                  </div>
                </section>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t pt-4" style={{ borderColor: BORDER }}>
              <button
                type="button"
                onClick={handleClearFilters}
                className="border px-4 py-2 text-[12px] font-medium transition-colors hover:bg-[#f7f5f2]"
                style={{ borderColor: BORDER, borderRadius: 6, color: "#666" }}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: PRIMARY, borderRadius: 6 }}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        )}
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
                  bundleMode={bundleMode}
                  onBundleAdd={handleBundleAdd}
                  ratingsByProveedor={ratingsByProveedor}
                  comparando={comparando}
                  onToggleComparar={toggleComparar}
                  favoritos={favoritos}
                  fechaBusquedaDesde={fechaBusquedaInicioParam}
                  fechaBusquedaHasta={fechaBusquedaFinParam}
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
          {/* Siempre mostrar el mapa */}
          <RealMap
            results={results}
            hoveredIndex={hoveredIndex}
            selectedIndex={selectedIndex}
            onPinHover={setHoveredIndex}
            onPinLeave={() => setHoveredIndex(null)}
            onPinSelect={handleSelect}
            extra={extra}
            t={t}
            bundleMode={bundleMode}
            origenId={origenParam}
            onBundleAdd={handleBundleAdd}
          />
        </div>
      </div>

      {comparando.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            borderTop: "1.5px solid #1d4f91",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 100,
            boxShadow: "0 -4px 20px rgba(0,0,0,.1)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#2a3a4a",
              whiteSpace: "nowrap",
            }}
          >
            Comparar
          </span>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 140,
                  height: 44,
                  borderRadius: 8,
                  border: comparando[i]
                    ? `1.5px solid ${getColor(comparando[i].vertical)}`
                    : "1.5px dashed #e8e4de",
                  background: comparando[i]
                    ? getLightColor(comparando[i].vertical)
                    : "#f7f5f2",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px",
                  fontSize: 10,
                }}
              >
                {comparando[i] ? (
                  <>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: getColor(comparando[i].vertical),
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                        color: "#2a3a4a",
                      }}
                    >
                      {comparando[i].titulo}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer", color: "#bbb" }}
                      onClick={() => quitarComparar(comparando[i].id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          quitarComparar(comparando[i].id);
                        }
                      }}
                    >
                      ×
                    </span>
                  </>
                ) : (
                  <span style={{ color: "#bbb", margin: "0 auto" }}>+ Añadir</span>
                )}
              </div>
            ))}
          </div>
          <span
            role="button"
            tabIndex={0}
            style={{ fontSize: 11, color: "#888", cursor: "pointer" }}
            onClick={() => setComparando([])}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setComparando([]);
            }}
          >
            Limpiar
          </span>
          <button
            type="button"
            disabled={comparando.length < 2}
            onClick={() =>
              router.push(`/comparar?ids=${comparando.map((s) => s.id).join(",")}`)
            }
            style={{
              background: comparando.length >= 2 ? "#1d4f91" : "#bbb",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              fontSize: 12,
              cursor: comparando.length >= 2 ? "pointer" : "default",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Comparar {comparando.length} →
          </button>
        </div>
      )}
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#aaa" }}>Cargando...</div>}>
      <BuscarContent />
    </Suspense>
  );
}
