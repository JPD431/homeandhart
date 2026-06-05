"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { getFamiliaInitials } from "@/app/lib/familia";
import {
  VERTICAL_THEME,
  daysBetween,
  formatDateRange,
  formatEuro,
  getBookingEstado,
} from "@/app/lib/viajes";
import { supabase } from "@/lib/supabase";

// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referidos_count integer DEFAULT 0;

const LOGROS_DEF = [
  {
    id: "primer_alojamiento",
    emoji: "🏠",
    titulo: "Primer alojamiento",
    descripcion: "Primera reserva de alojamiento completada",
  },
  {
    id: "familia_completa",
    emoji: "🧒",
    titulo: "Familia completa",
    descripcion: "Alojamiento + niñera en el mismo viaje",
  },
  {
    id: "viaje_mascota",
    emoji: "🐾",
    titulo: "Viaje con mascota",
    descripcion: "Alojamiento + cuidador de mascotas",
  },
  {
    id: "cliente_premium",
    emoji: "⭐",
    titulo: "Cliente premium",
    descripcion: "10 reservas completadas",
  },
  {
    id: "viajero_frecuente",
    emoji: "🌍",
    titulo: "Viajero frecuente",
    descripcion: "3 ciudades diferentes",
  },
  {
    id: "embajador",
    emoji: "💎",
    titulo: "Embajador H&H",
    descripcion: "5 amigos referidos",
  },
];

function PassportIcon({ className }) {
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
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.125 1.125 0 1 1-2.25 0 1.125 1.125 0 0 1 2.25 0Zm1.125 4.125a1.125 1.125 0 1 1-2.25 0 1.125 1.125 0 0 1 2.25 0Z"
      />
    </svg>
  );
}

function StatCard({ label, value, sublabel }) {
  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: BRAND.border }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-bold sm:text-3xl"
        style={{ color: BRAND.primary }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1 text-xs text-[#888]">{sublabel}</p>}
    </div>
  );
}

function formatRegistroDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function computeStats(completadas) {
  const ciudadesSet = new Set();
  const ciudadCounts = {};
  const proveedoresSet = new Set();
  let nochesAlojamiento = 0;
  let horasNinos = 0;
  let diasMascotas = 0;
  let totalInvertido = 0;
  let tieneAlojamiento = false;

  for (const booking of completadas) {
    const service = booking.services ?? {};
    const vertical = service.vertical;
    const ciudad = service.ciudad?.trim();

    totalInvertido += Number(booking.precio_total) || 0;

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

    if (vertical === "mascotas") {
      const dias = Math.max(
        1,
        daysBetween(booking.fecha_inicio, booking.fecha_fin || booking.fecha_inicio) || 1,
      );
      diasMascotas += dias;
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
    diasMascotas,
    proveedoresDistintos: proveedoresSet.size,
    totalInvertido,
    ciudadesLista,
    tieneAlojamiento,
    reservasCompletadas: completadas.length,
  };
}

function computeLogros(stats, viajesVerticals, referidosCount) {
  const unlocked = new Set();

  if (stats.tieneAlojamiento) unlocked.add("primer_alojamiento");
  if (stats.reservasCompletadas >= 10) unlocked.add("cliente_premium");
  if (stats.ciudadesVisitadas >= 3) unlocked.add("viajero_frecuente");
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

export default function PasaportePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authCreatedAt, setAuthCreatedAt] = useState(null);
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
      setAuthCreatedAt(user.created_at);

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
                vertical,
                profiles:proveedor_id (
                  nombre,
                  apellido,
                  foto_perfil,
                  avatar_url
                )
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
  const fechaRegistro =
    profile?.fecha_registro || authCreatedAt;

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-[#666]">
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
      <Navbar />

      <header
        className="relative overflow-hidden px-4 py-10 text-white sm:px-6 sm:py-12"
        style={{
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, #163a6b 60%, #0e7a5c 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-20"
          style={{ backgroundColor: "#fff" }}
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full opacity-10"
          style={{ backgroundColor: "#fff" }}
        />

        <div className="relative mx-auto max-w-4xl">
          <Link
            href="/dashboard"
            className="text-sm text-white/80 no-underline transition-opacity hover:opacity-100"
          >
            ← Volver al dashboard
          </Link>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur"
                >
                  <PassportIcon className="h-7 w-7 text-white" />
                </span>
                <h1
                  className="text-2xl font-bold sm:text-3xl"
                  style={{ fontFamily: SERIF }}
                >
                  Tu pasaporte Home&Heart
                </h1>
              </div>
              <p className="mt-3 text-lg text-white/90">{nombreCompleto}</p>
              <p className="mt-1 text-sm text-white/70">
                Miembro desde {formatRegistroDate(fechaRegistro)}
              </p>
            </div>
            <div
              className="rounded-2xl border border-white/25 bg-white/10 px-5 py-4 backdrop-blur"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                Número de miembro
              </p>
              <p
                className="mt-1 font-mono text-2xl font-bold tracking-wider"
              >
                #{memberNumber}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <h2
            className="text-lg font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Estadísticas del pasaporte
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Ciudades visitadas"
              value={stats.ciudadesVisitadas}
            />
            <StatCard
              label="Noches alojadas"
              value={stats.nochesAlojamiento}
              sublabel="Alojamiento completado"
            />
            <StatCard
              label="Horas de cuidado"
              value={stats.horasNinos}
              sublabel="Cuidado de niños"
            />
            <StatCard
              label="Días con mascotas"
              value={stats.diasMascotas}
              sublabel="Cuidado de mascotas"
            />
            <StatCard
              label="Proveedores"
              value={stats.proveedoresDistintos}
              sublabel="Distintos con los que has trabajado"
            />
            <StatCard
              label="Total invertido"
              value={formatEuro(stats.totalInvertido)}
              sublabel="En servicios completados"
            />
          </div>
        </section>

        <section
          className="rounded-2xl border bg-white p-6"
          style={{ borderColor: BRAND.border }}
        >
          <h2
            className="text-lg font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Mapa de ciudades visitadas
          </h2>
          {stats.ciudadesLista.length === 0 ? (
            <p className="mt-4 text-sm text-[#666]">
              Aún no has completado reservas en ninguna ciudad.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {stats.ciudadesLista.map((ciudad) => (
                <li
                  key={ciudad.nombre}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {ciudad.nombre.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-[#1a1a1a]">
                      {ciudad.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#666]">
                      {ciudad.count} reserva{ciudad.count !== 1 ? "s" : ""}
                    </span>
                    {ciudad.favorita && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: "#fce7f3", color: "#be185d" }}
                      >
                        Ciudad favorita ❤️
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2
            className="text-lg font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Historial de viajes
          </h2>
          {viajes.length === 0 ? (
            <div
              className="mt-4 rounded-2xl border bg-white px-6 py-10 text-center"
              style={{ borderColor: BRAND.border }}
            >
              <p className="text-sm text-[#666]">
                Crea tu primer viaje para construir tu pasaporte.
              </p>
              <Link
                href="/viaje/nuevo"
                className="mt-4 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}
              >
                Crear viaje
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {viajes.map((viaje) => {
                const reservas = (viaje.viaje_reservas ?? [])
                  .map((vr) => vr.bookings)
                  .filter(Boolean);
                const proveedores = [];
                const seen = new Set();

                for (const booking of reservas) {
                  const p = booking.services?.profiles;
                  const pid = p?.nombre + p?.apellido;
                  if (p && !seen.has(pid)) {
                    seen.add(pid);
                    proveedores.push(p);
                  }
                }

                return (
                  <li
                    key={viaje.id}
                    className="rounded-2xl border bg-white p-5 sm:p-6"
                    style={{ borderColor: BRAND.border }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link
                          href={`/viaje/${viaje.id}`}
                          className="text-lg font-semibold no-underline transition-opacity hover:opacity-80"
                          style={{ color: BRAND.primary, fontFamily: SERIF }}
                        >
                          {viaje.nombre}
                        </Link>
                        <p className="mt-1 text-sm text-[#666]">
                          {formatDateRange(viaje.fecha_inicio, viaje.fecha_fin)}
                          {viaje.ciudad ? ` · ${viaje.ciudad}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-[#888]">
                          {reservas.length} servicio
                          {reservas.length !== 1 ? "s" : ""} contratado
                          {reservas.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {proveedores.length > 0 && (
                        <div className="flex -space-x-2">
                          {proveedores.slice(0, 5).map((p, i) => {
                            const url = p.foto_perfil || p.avatar_url;
                            const initials = getFamiliaInitials(
                              p.nombre,
                              p.apellido,
                            );
                            return url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="h-10 w-10 rounded-full border-2 border-white object-cover"
                              />
                            ) : (
                              <span
                                key={i}
                                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-xs font-semibold"
                                style={{
                                  backgroundColor: BRAND.light,
                                  color: BRAND.primary,
                                }}
                              >
                                {initials}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {reservas.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {reservas.map((booking) => {
                          const svc = booking.services ?? {};
                          const theme =
                            VERTICAL_THEME[svc.vertical] ??
                            VERTICAL_THEME.alojamiento;
                          return (
                            <li
                              key={booking.id ?? svc.titulo}
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: theme.light,
                                color: theme.color,
                              }}
                            >
                              {svc.titulo || theme.label}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="rounded-2xl border bg-white p-6"
          style={{ borderColor: BRAND.border }}
        >
          <h2
            className="text-lg font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Logros desbloqueables
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOGROS_DEF.map((logro) => {
              const unlocked = logrosUnlocked.has(logro.id);
              return (
                <div
                  key={logro.id}
                  className="rounded-xl border px-4 py-4 transition-opacity"
                  style={{
                    borderColor: unlocked ? BRAND.primary : BRAND.border,
                    backgroundColor: unlocked ? BRAND.light : "#fafafa",
                    opacity: unlocked ? 1 : 0.65,
                  }}
                >
                  <p className="text-2xl">{logro.emoji}</p>
                  <p
                    className="mt-2 text-sm font-semibold"
                    style={{ color: unlocked ? BRAND.primary : "#666" }}
                  >
                    {logro.titulo}
                  </p>
                  <p className="mt-1 text-xs text-[#888]">{logro.descripcion}</p>
                  <p
                    className="mt-2 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: unlocked ? "#166534" : "#aaa" }}
                  >
                    {unlocked ? "Desbloqueado ✓" : "Bloqueado"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
