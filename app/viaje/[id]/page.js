"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { getFamiliaInitials, getFamiliaMiembros } from "@/app/lib/familia";
import {
  VERTICAL_THEME,
  buildTimelineItems,
  formatDateRange,
  formatEuro,
  getBookingEstado,
  userCanAccessViaje,
} from "@/app/lib/viajes";
import { supabase } from "@/app/lib/supabase";

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
  confirmada: { bg: BRAND.light, color: BRAND.primary, label: "Confirmada" },
  en_curso: { bg: "#e0e7ff", color: "#3730a3", label: "En curso" },
  completada: { bg: "#dcfce7", color: "#166534", label: "Completada" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencia" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
  cancelada_garantia: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
};

function StatusBadge({ status }) {
  const key = status ?? "pendiente";
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function VerticalIcon({ vertical, color }) {
  const paths = {
    alojamiento:
      "M2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
    ninos:
      "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
    mascotas: null,
  };

  if (vertical === "mascotas") {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
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

  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke={color}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={paths[vertical] || paths.alojamiento}
      />
    </svg>
  );
}

export default function ViajePage() {
  const router = useRouter();
  const params = useParams();
  const viajeId = params.id;

  const [loading, setLoading] = useState(true);
  const [viaje, setViaje] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [shareMessage, setShareMessage] = useState("");

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

      const { data: viajeData, error: viajeError } = await supabase
        .from("viajes")
        .select("*")
        .eq("id", viajeId)
        .single();

      if (viajeError || !viajeData) {
        router.replace("/dashboard");
        return;
      }

      const canAccess = await userCanAccessViaje(
        supabase,
        viajeData,
        user.id,
      );
      if (!canAccess) {
        router.replace("/dashboard");
        return;
      }

      setViaje(viajeData);

      if (viajeData.familia_id) {
        const lista = await getFamiliaMiembros(supabase, viajeData.familia_id);
        setMiembros(lista.filter((m) => m.estado === "activo"));
      }

      const { data: reservasData } = await supabase
        .from("viaje_reservas")
        .select(
          `
          booking_id,
          bookings:booking_id (
            id,
            fecha_inicio,
            fecha_fin,
            hora,
            precio_total,
            estado,
            services:service_id (
              titulo,
              vertical,
              profiles_public:proveedor_id (nombre, apellido)
            )
          )
        `,
        )
        .eq("viaje_id", viajeId);

      const linked = (reservasData ?? [])
        .map((r) => r.bookings)
        .filter(Boolean);

      setBookings(linked);
      setLoading(false);
    }

    if (viajeId) load();
  }, [viajeId, router]);

  const timelineItems = useMemo(
    () => buildTimelineItems(bookings, viaje?.ciudad),
    [bookings, viaje?.ciudad],
  );

  const costSummary = useMemo(() => {
    return bookings.map((booking) => {
      const service = booking.services ?? {};
      return {
        id: booking.id,
        titulo: service.titulo || "Servicio",
        precio: Number(booking.precio_total) || 0,
      };
    });
  }, [bookings]);

  const totalCost = useMemo(
    () => costSummary.reduce((sum, item) => sum + item.precio, 0),
    [costSummary],
  );

  const pendientesCount = useMemo(
    () =>
      bookings.filter((b) => getBookingEstado(b) === "pendiente").length,
    [bookings],
  );

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("¡Link copiado!");
    } catch {
      setShareMessage("No se pudo copiar el link.");
    }
    setTimeout(() => setShareMessage(""), 2500);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando tablón de viaje…
        </main>
      </div>
    );
  }

  if (!viaje) return null;

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <header
        className="border-b bg-white px-4 py-6 sm:px-6"
        style={{ borderColor: BRAND.border }}
      >
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="text-sm no-underline transition-opacity hover:opacity-80"
            style={{ color: BRAND.primary }}
          >
            ← Mis viajes
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1
                className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl"
                style={{ fontFamily: SERIF }}
              >
                {viaje.nombre}
              </h1>
              <p className="mt-1 text-sm text-[#666]">
                {formatDateRange(viaje.fecha_inicio, viaje.fecha_fin)}
                {viaje.ciudad ? ` · ${viaje.ciudad}` : ""}
              </p>
              {miembros.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {miembros.map((miembro) => {
                    const perfil = miembro.profiles_public;
                    const avatarUrl =
                      perfil?.foto_perfil || perfil?.avatar_url || null;
                    const initials = getFamiliaInitials(
                      perfil?.nombre,
                      perfil?.apellido,
                    );
                    const nombre =
                      [perfil?.nombre, perfil?.apellido]
                        .filter(Boolean)
                        .join(" ") || "Miembro";

                    return avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={miembro.id}
                        src={avatarUrl}
                        alt=""
                        title={nombre}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <span
                        key={miembro.id}
                        title={nombre}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white"
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
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <button
                type="button"
                onClick={handleShare}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[#e8f0fb]"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                Compartir viaje
              </button>
              {shareMessage && (
                <span className="text-xs text-green-700">{shareMessage}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              className="text-lg font-semibold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              Timeline del viaje
            </h2>

            {timelineItems.length === 0 ? (
              <p
                className="mt-4 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
                style={{ borderColor: BRAND.border }}
              >
                Aún no hay servicios en este viaje. Añade reservas desde la
                creación del viaje o busca proveedores.
              </p>
            ) : (
              <ul className="relative mt-6 flex flex-col gap-4">
                <div
                  className="absolute bottom-2 left-5 top-2 w-0.5"
                  style={{ backgroundColor: BRAND.border }}
                  aria-hidden
                />
                {timelineItems.map((item, index) => {
                  if (item.type === "gap") {
                    const buscarUrl = `/buscar?ciudad=${encodeURIComponent(item.ciudad || "")}&desde=${item.gapStart}&hasta=${item.gapEnd}`;
                    return (
                      <li key={`gap-${index}`} className="relative pl-12">
                        <span
                          className="absolute left-3 top-4 h-4 w-4 rounded-full border-2 border-white"
                          style={{ backgroundColor: "#c47d1a" }}
                        />
                        <div
                          className="rounded-xl border border-dashed bg-white px-4 py-4"
                          style={{ borderColor: "#c47d1a" }}
                        >
                          <p className="text-sm font-medium text-[#92400e]">
                            Sin cobertura · Buscar proveedor
                          </p>
                          <p className="mt-1 text-xs text-[#888]">
                            {formatDateRange(item.gapStart, item.gapEnd)}
                          </p>
                          <Link
                            href={buscarUrl}
                            className="mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                            style={{ backgroundColor: BRAND.primary }}
                          >
                            Buscar proveedor
                          </Link>
                        </div>
                      </li>
                    );
                  }

                  const booking = item.booking;
                  const service = booking.services ?? {};
                  const proveedor = service.profiles_public ?? {};
                  const vertical = service.vertical || "alojamiento";
                  const theme =
                    VERTICAL_THEME[vertical] ?? VERTICAL_THEME.alojamiento;
                  const estado = getBookingEstado(booking);
                  const proveedorNombre =
                    [proveedor.nombre, proveedor.apellido]
                      .filter(Boolean)
                      .join(" ") || "Proveedor";

                  return (
                    <li key={booking.id} className="relative pl-12">
                      <span
                        className="absolute left-3 top-5 h-4 w-4 rounded-full border-2 border-white"
                        style={{ backgroundColor: theme.color }}
                      />
                      <div
                        className="rounded-2xl border bg-white p-5"
                        style={{ borderColor: BRAND.border }}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: theme.light }}
                          >
                            <VerticalIcon
                              vertical={vertical}
                              color={theme.color}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[#1a1a1a]">
                                {service.titulo || theme.label}
                              </p>
                              <StatusBadge status={estado} />
                            </div>
                            <p className="mt-0.5 text-sm text-[#666]">
                              {proveedorNombre}
                            </p>
                            <p className="mt-1 text-xs text-[#888]">
                              {formatDateRange(
                                booking.fecha_inicio,
                                booking.fecha_fin,
                              )}
                              {booking.hora ? ` · ${booking.hora}` : ""}
                            </p>
                            <p
                              className="mt-2 text-lg font-bold"
                              style={{ color: theme.color }}
                            >
                              {formatEuro(booking.precio_total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside className="lg:col-span-1">
            <div
              className="sticky top-6 rounded-2xl border bg-white p-6"
              style={{ borderColor: BRAND.border }}
            >
              <h2
                className="text-lg font-semibold text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                Resumen
              </h2>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Estado general
                </p>
                {pendientesCount === 0 && bookings.length > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-green-700">
                    Todo confirmado ✓
                  </p>
                ) : pendientesCount > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-[#92400e]">
                    {pendientesCount} servicio
                    {pendientesCount !== 1 ? "s" : ""} pendiente
                    {pendientesCount !== 1 ? "s" : ""} de confirmar
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[#666]">
                    Sin servicios aún
                  </p>
                )}
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Costes
                </p>
                {costSummary.length === 0 ? (
                  <p className="mt-2 text-sm text-[#666]">—</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {costSummary.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate text-[#444]">
                          {item.titulo}
                        </span>
                        <span
                          className="shrink-0 font-semibold"
                          style={{ color: BRAND.primary }}
                        >
                          {formatEuro(item.precio)}
                        </span>
                      </li>
                    ))}
                    <li
                      className="flex items-center justify-between gap-2 border-t pt-3 text-sm font-bold"
                      style={{ borderColor: BRAND.border }}
                    >
                      <span className="text-[#1a1a1a]">Total del viaje</span>
                      <span style={{ color: BRAND.primary }}>
                        {formatEuro(totalCost)}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
