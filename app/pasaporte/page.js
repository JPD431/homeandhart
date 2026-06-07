"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  daysBetween,
  formatDateRange,
  getBookingEstado,
} from "@/app/lib/viajes";
import { supabase } from "@/lib/supabase";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

const CITY_DOT_COLORS = [PRIMARY, "#0e7a5c", "#c47d1a", "#7c3aed", "#dc2626"];

const LOGROS_DEF = [
  {
    id: "primer_alojamiento",
    emoji: "🏠",
    titulo: "Primer alojamiento",
    descripcion: "1 reserva de alojamiento completada",
    theme: "blue",
  },
  {
    id: "familia_completa",
    emoji: "🧒",
    titulo: "Familia completa",
    descripcion: "Alojamiento + niñera en el mismo viaje",
    theme: "green",
  },
  {
    id: "viaje_mascota",
    emoji: "🐾",
    titulo: "Viaje con mascota",
    descripcion: "Alojamiento + mascotas en el mismo viaje",
    theme: "amber",
  },
  {
    id: "cliente_premium",
    emoji: "⭐",
    titulo: "Cliente premium",
    descripcion: "10 reservas completadas",
    theme: "blue",
  },
  {
    id: "viajero_frecuente",
    emoji: "🌍",
    titulo: "Viajero frecuente",
    descripcion: "5 ciudades diferentes",
    theme: "green",
  },
  {
    id: "embajador",
    emoji: "💎",
    titulo: "Embajador H&H",
    descripcion: "5 referidos",
    theme: "amber",
  },
];

const UNLOCKED_THEMES = {
  blue: { bg: "#e8f0fb", border: PRIMARY, badgeBg: "#e8f0fb", badgeColor: PRIMARY },
  green: { bg: "#e6f4f0", border: "#0e7a5c", badgeBg: "#e6f4f0", badgeColor: "#0e7a5c" },
  amber: { bg: "#fdf3e3", border: "#c47d1a", badgeBg: "#fdf3e3", badgeColor: "#c47d1a" },
};

function MiniNavbar() {
  return (
    <nav
      className="flex items-center justify-between border-b bg-white px-6 py-3"
      style={{ borderColor: BORDER }}
    >
      <Link
        href="/"
        className="no-underline"
        style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}
      >
        Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
      </Link>
      <Link href="/dashboard" className="text-sm no-underline" style={{ color: "#666" }}>
        ← Dashboard
      </Link>
    </nav>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      className="rounded-xl border bg-white p-4"
      style={{ borderColor: BORDER }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-widest text-[#bbb]">
        {label}
      </p>
      <p
        className="mt-2 text-[24px]"
        style={{ color: PRIMARY, fontWeight: 200 }}
      >
        {value}
      </p>
    </div>
  );
}

function computeStats(completadas) {
  const ciudadesSet = new Set();
  const ciudadCounts = {};
  const proveedoresSet = new Set();
  let nochesAlojamiento = 0;
  let horasNinos = 0;
  let tieneAlojamiento = false;

  for (const booking of completadas) {
    const service = booking.services ?? {};
    const vertical = service.vertical;
    const ciudad = service.ciudad?.trim();

    if (service.proveedor_id) {
      proveedoresSet.add(service.proveedor_id);
    }

    if (ciudad) {
      ciudadesSet.add(ciudad.toLowerCase());
      const key = ciudad;
      ciudadCounts[key] = (ciudadCounts[key] || 0) + 1;
    }

    if (vertical === "alojamiento") {
      tieneAlojamiento = true;
      const nights = Math.max(
        1,
        daysBetween(booking.fecha_inicio, booking.fecha_fin || booking.fecha_inicio) || 1,
      );
      nochesAlojamiento += nights;
    }

    if (vertical === "ninos") {
      horasNinos += Number(booking.duracion_horas) || 0;
    }
  }

  const ciudadesLista = Object.entries(ciudadCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, count]) => ({
      nombre,
      count,
      favorita: count >= 3,
    }));

  return {
    ciudadesVisitadas: ciudadesSet.size,
    nochesAlojamiento,
    horasNinos,
    proveedoresDistintos: proveedoresSet.size,
    ciudadesLista,
    tieneAlojamiento,
    reservasCompletadas: completadas.length,
  };
}

function computeLogros(stats, viajesVerticals, referidosCount) {
  const unlocked = new Set();

  if (stats.tieneAlojamiento) unlocked.add("primer_alojamiento");
  if (stats.reservasCompletadas >= 10) unlocked.add("cliente_premium");
  if (stats.ciudadesVisitadas >= 5) unlocked.add("viajero_frecuente");
  if (referidosCount >= 5) unlocked.add("embajador");

  for (const verticals of viajesVerticals) {
    if (verticals.has("alojamiento") && verticals.has("ninos")) {
      unlocked.add("familia_completa");
    }
    if (verticals.has("alojamiento") && verticals.has("mascotas")) {
      unlocked.add("viaje_mascota");
    }
  }

  return unlocked;
}

function getLogroProgress(id, stats, referidosCount) {
  switch (id) {
    case "viajero_frecuente":
      return { current: stats.ciudadesVisitadas, target: 5 };
    case "embajador":
      return { current: referidosCount, target: 5 };
    case "cliente_premium":
      return { current: stats.reservasCompletadas, target: 10 };
    case "primer_alojamiento":
      return { current: stats.tieneAlojamiento ? 1 : 0, target: 1 };
    default:
      return null;
  }
}

function getViajeEmoji(viaje) {
  const verticals = new Set();
  for (const vr of viaje.viaje_reservas ?? []) {
    const v = vr.bookings?.services?.vertical;
    if (v) verticals.add(v);
  }
  if (verticals.has("mascotas")) return "🐾";
  if (verticals.has("ninos")) return "🧒";
  if (verticals.has("alojamiento")) return "🏠";
  return "🧳";
}

export default function PasaportePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [completadas, setCompletadas] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [referidosCount, setReferidosCount] = useState(0);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("nombre, apellido, fecha_registro, referidos_count")
        .eq("id", user.id)
        .single();

      setProfile(profileData);
      setReferidosCount(Number(profileData?.referidos_count) || 0);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          `
          id,
          fecha_inicio,
          fecha_fin,
          duracion_horas,
          precio_total,
          estado,
          status,
          services:service_id (
            vertical,
            ciudad,
            proveedor_id
          )
        `,
        )
        .eq("cliente_id", user.id);

      const done = (bookingsData ?? []).filter(
        (b) => getBookingEstado(b) === "completada",
      );
      setCompletadas(done);

      const { data: viajesData } = await supabase
        .from("viajes")
        .select(
          `
          id,
          nombre,
          fecha_inicio,
          fecha_fin,
          ciudad,
          viaje_reservas (
            bookings:booking_id (
              id,
              services:service_id (
                titulo,
                vertical
              )
            )
          )
        `,
        )
        .eq("creador_id", user.id)
        .order("fecha_inicio", { ascending: false });

      setViajes(viajesData ?? []);
      setLoading(false);
    }

    load();
  }, [router]);

  const stats = useMemo(() => computeStats(completadas), [completadas]);

  const viajesVerticals = useMemo(() => {
    return viajes.map((viaje) => {
      const verticals = new Set();
      for (const vr of viaje.viaje_reservas ?? []) {
        const v = vr.bookings?.services?.vertical;
        if (v) verticals.add(v);
      }
      return verticals;
    });
  }, [viajes]);

  const logrosUnlocked = useMemo(
    () => computeLogros(stats, viajesVerticals, referidosCount),
    [stats, viajesVerticals, referidosCount],
  );

  const nombreCompleto =
    [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || "Viajero";
  const memberNumber = userId
    ? userId.replace(/-/g, "").slice(0, 6).toUpperCase()
    : "——";

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <MiniNavbar />
        <main className="px-6 py-16 text-center text-sm text-[#666]">
          Cargando tu pasaporte…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <MiniNavbar />

      <main className="mx-auto space-y-5" style={{ padding: 24, maxWidth: 900 }}>
        {/* Tarjeta de pasaporte */}
        <div
          className="relative overflow-hidden text-white"
          style={{
            borderRadius: 16,
            padding: 28,
            background: `linear-gradient(135deg, ${PRIMARY} 0%, #163a6b 100%)`,
          }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className="inline-block rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                  Home&Heart · Pasaporte familiar
                </span>
                <h1
                  className="mt-3 text-[24px] text-white"
                  style={{ fontFamily: SERIF, fontWeight: 300 }}
                >
                  {nombreCompleto}
                </h1>
                <p className="mt-1 font-mono text-sm text-white/60">
                  #{memberNumber}
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                🛂
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Ciudades", value: stats.ciudadesVisitadas },
                { label: "Reservas", value: stats.reservasCompletadas },
                { label: "Noches", value: stats.nochesAlojamiento },
                { label: "Horas cuidado", value: stats.horasNinos },
              ].map((item) => (
                <div key={item.label}>
                  <p
                    className="text-[28px] text-white"
                    style={{ fontWeight: 200 }}
                  >
                    {item.value}
                  </p>
                  <p className="text-[10px] text-white/50">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4 sm:justify-start">
              {LOGROS_DEF.map((logro) => {
                const unlocked = logrosUnlocked.has(logro.id);
                return (
                  <div key={logro.id} className="flex flex-col items-center">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-base"
                      style={{
                        border: "1px solid rgba(255,255,255,0.2)",
                        opacity: unlocked ? 1 : 0.3,
                        filter: unlocked ? "none" : "grayscale(100%)",
                      }}
                    >
                      {logro.emoji}
                    </div>
                    <span
                      className="mt-1 max-w-[56px] text-center text-[8px] leading-tight"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {logro.titulo}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4 stats cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Ciudades visitadas" value={stats.ciudadesVisitadas} />
          <StatCard label="Reservas totales" value={stats.reservasCompletadas} />
          <StatCard label="Noches alojadas" value={stats.nochesAlojamiento} />
          <StatCard label="Proveedores distintos" value={stats.proveedoresDistintos} />
        </div>

        {/* Grid 2 columnas */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="rounded-xl border bg-white p-5"
            style={{ borderColor: BORDER }}
          >
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Ciudades visitadas</h2>
            {stats.ciudadesLista.length === 0 ? (
              <p className="mt-4 text-sm text-[#666]">
                Aún no has completado reservas en ninguna ciudad.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {stats.ciudadesLista.map((ciudad, index) => (
                  <li
                    key={ciudad.nombre}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CITY_DOT_COLORS[index % CITY_DOT_COLORS.length],
                        }}
                      />
                      <span className="truncate text-sm font-medium text-[#1a1a1a]">
                        {ciudad.nombre}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-[#888]">
                        {ciudad.count} reserva{ciudad.count !== 1 ? "s" : ""}
                      </span>
                      {ciudad.favorita && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
                        >
                          ❤️ Favorita
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-xl border bg-white p-5"
            style={{ borderColor: BORDER }}
          >
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Mis viajes</h2>
            {viajes.length === 0 ? (
              <p className="mt-4 text-sm text-[#666]">
                Crea tu primer viaje para construir tu pasaporte.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {viajes.map((viaje) => {
                  const reservas = (viaje.viaje_reservas ?? [])
                    .map((vr) => vr.bookings)
                    .filter(Boolean);
                  return (
                    <li key={viaje.id}>
                      <Link
                        href={`/viaje/${viaje.id}`}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 no-underline transition-colors hover:bg-[#f7f5f2]"
                        style={{ borderColor: BORDER }}
                      >
                        <span className="text-lg">{getViajeEmoji(viaje)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#1a1a1a]">
                            {viaje.nombre}
                          </p>
                          <p className="text-[11px] text-[#888]">
                            {formatDateRange(viaje.fecha_inicio, viaje.fecha_fin)}
                            {" · "}
                            {reservas.length} servicio
                            {reservas.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/viaje/nuevo"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold no-underline"
              style={{ color: PRIMARY }}
            >
              + Crear nuevo viaje
            </Link>
          </section>
        </div>

        {/* Logros */}
        <section>
          <h2
            className="mb-4 text-sm font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Logros
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOGROS_DEF.map((logro) => {
              const unlocked = logrosUnlocked.has(logro.id);
              const theme = UNLOCKED_THEMES[logro.theme];
              const progress = getLogroProgress(
                logro.id,
                stats,
                referidosCount,
              );

              return (
                <div
                  key={logro.id}
                  className="rounded-xl border px-4 py-4"
                  style={{
                    borderColor: unlocked ? theme.border : BORDER,
                    backgroundColor: unlocked ? theme.bg : "#f7f5f2",
                  }}
                >
                  <p
                    className="text-2xl"
                    style={{
                      opacity: unlocked ? 1 : 0.4,
                      filter: unlocked ? "none" : "grayscale(100%)",
                    }}
                  >
                    {logro.emoji}
                  </p>
                  <p
                    className="mt-2 text-sm font-semibold"
                    style={{ color: unlocked ? theme.border : "#666" }}
                  >
                    {logro.titulo}
                  </p>
                  <p className="mt-1 text-xs text-[#888]">{logro.descripcion}</p>
                  {unlocked ? (
                    <span
                      className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeColor,
                      }}
                    >
                      Desbloqueado ✓
                    </span>
                  ) : (
                    <span
                      className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: "#eee", color: "#888" }}
                    >
                      {progress
                        ? `${progress.current}/${progress.target}`
                        : "Bloqueado"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
