"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const DARK_BLUE = "#163a6b";

const FILTER_TABS = [
  { id: "todo", label: "Todo" },
  { id: "alojamiento", label: "Alojamiento" },
  { id: "ninos", label: "Niños" },
  { id: "mascotas", label: "Mascotas" },
];

const CANCEL_LABELS = {
  "24h": "Cancelación gratuita hasta 24h antes",
  "48h": "Hasta 48h antes",
  "7d": "Hasta 7 días antes",
  none: "Sin cancelación",
};

const VERTICALS = {
  alojamiento: {
    label: "Alojamiento",
    priceSuffix: "/ noche",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    priceSuffix: "/ hora",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    priceSuffix: "/ día",
    Icon: PetIcon,
  },
};

function HomeIcon({ className }) {
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
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function PersonIcon({ className }) {
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
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function PetIcon({ className }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7" cy="4" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="17" cy="4" r="1.5" />
      <circle cx="4.5" cy="8.5" r="1.5" />
      <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
    </svg>
  );
}

function CheckBadgeIcon({ className }) {
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
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
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
  const lastInitial = apellido?.trim()?.[0]
    ? `${apellido.trim()[0]}.`
    : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

function formatPrice(precio, suffix) {
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${suffix}`;
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

      let query = supabase
        .from("services")
        .select(
          `
          *,
          profiles (
            nombre,
            apellido,
            foto_perfil,
            idiomas,
            verificado,
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

  const resultCount = results.length;
  const resultLabel =
    resultCount === 1
      ? "1 resultado encontrado"
      : `${resultCount} resultados encontrados`;

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="max-w-2xl">
          <h1
            className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl"
            style={{ fontFamily: SERIF }}
          >
            Encuentra tu proveedor de confianza
          </h1>
          <p className="mt-2 text-sm text-[#666] sm:text-base">
            {loading ? "Buscando proveedores…" : resultLabel}
          </p>
        </header>

        {/* Filtros */}
        <div
          className="mt-6 rounded-2xl border bg-white p-4 sm:p-5"
          style={{ borderColor: BRAND.border }}
        >
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => {
              const isActive = verticalParam === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleVerticalChange(tab.id)}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor: isActive ? BRAND.primary : BRAND.border,
                    backgroundColor: isActive ? BRAND.light : "#fff",
                    color: isActive ? DARK_BLUE : "#444",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCiudadSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={ciudadInput}
              onChange={(e) => setCiudadInput(e.target.value)}
              placeholder="Ciudad, barrio o zona…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Buscar
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Resultados */}
        {!loading && !error && results.length === 0 && (
          <p
            className="mt-8 rounded-2xl border bg-white px-6 py-10 text-center text-sm leading-relaxed text-[#666] sm:text-base"
            style={{ borderColor: BRAND.border }}
          >
            No encontramos proveedores en esta zona todavía. Estamos creciendo
            cada semana.
          </p>
        )}

        {loading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl bg-white/80"
                style={{ borderColor: BRAND.border }}
              />
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((service) => {
              const profile = service.profiles ?? {};
              const vertical =
                VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
              const { Icon } = vertical;
              const cancelLabel =
                CANCEL_LABELS[service.cancellation_policy] ??
                service.cancellation_policy;
              const languages = Array.isArray(profile.idiomas)
                ? profile.idiomas
                : [];
              const zone =
                service.ciudad ||
                profile.location_zone ||
                profile.ciudad ||
                "España";
              const avatarUrl = profile.foto_perfil || null;

              return (
                <li
                  key={service.id}
                  className="flex flex-col rounded-2xl border bg-white p-5"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex items-start gap-3">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={formatShortName(profile.nombre, profile.apellido)}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: BRAND.light,
                          color: BRAND.primary,
                        }}
                      >
                        {getInitials(profile.nombre, profile.apellido)}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1a1a1a]">
                          {formatShortName(profile.nombre, profile.apellido) ||
                            "Proveedor"}
                        </p>
                        {profile.verificado === true && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: BRAND.light,
                              color: BRAND.primary,
                            }}
                          >
                            <CheckBadgeIcon className="h-3 w-3" />
                            Verificado
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#888]">{zone}</p>
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center gap-2 border-t pt-4"
                    style={{ borderColor: BRAND.border }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: BRAND.light,
                        color: BRAND.primary,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[#888]">
                        {vertical.label}
                      </p>
                      <p
                        className="text-lg font-bold"
                        style={{ color: BRAND.primary }}
                      >
                        {formatPrice(service.precio, vertical.priceSuffix)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] text-[#aaa]">{cancelLabel}</p>

                  {languages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: BRAND.warm,
                            color: DARK_BLUE,
                          }}
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/proveedor/${service.proveedor_id}`}
                    className="mt-4 block rounded-xl py-2.5 text-center text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Ver perfil
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
