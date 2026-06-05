"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendientes" },
  confirmada: { bg: BRAND.light, color: BRAND.primary, label: "Confirmadas" },
  en_curso: { bg: "#e0e7ff", color: "#3730a3", label: "En curso" },
  completada: { bg: "#dcfce7", color: "#166534", label: "Completadas" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Canceladas" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencias" },
};

const STATUS_ORDER = [
  "pendiente",
  "confirmada",
  "en_curso",
  "completada",
  "cancelada",
  "incidencia",
];

function getBookingEstado(booking) {
  return booking.estado ?? booking.status ?? "pendiente";
}

function getNetIncome(precioTotal) {
  return ((Number(precioTotal) || 0) / 1.14) * 0.96;
}

function formatEuro(value) {
  return `${Number(value).toFixed(2)}€`;
}

function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-ES", { month: "short" }),
    });
  }
  return months;
}

function MetricCard({ label, value, sublabel }) {
  return (
    <div
      className="rounded-2xl border bg-white p-6"
      style={{ borderColor: BRAND.border }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        {label}
      </p>
      <p
        className="mt-3 text-3xl font-bold sm:text-4xl"
        style={{ color: BRAND.primary }}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-xs text-[#888]">{sublabel}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    async function loadStats() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "proveedor") {
        router.replace("/dashboard");
        return;
      }

      const { data: servicesData } = await supabase
        .from("services")
        .select("id, titulo")
        .eq("proveedor_id", user.id);

      const providerServices = servicesData ?? [];
      setServices(providerServices);

      const serviceIds = providerServices.map((s) => s.id);
      if (serviceIds.length > 0) {
        const { data: bookingsData } = await supabase
          .from("bookings")
          .select("id, service_id, precio_total, estado, status, created_at")
          .in("service_id", serviceIds);

        setBookings(bookingsData ?? []);
      } else {
        setBookings([]);
      }

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("valoracion, service_id")
        .eq("proveedor_id", user.id);

      setReviews(reviewsData ?? []);
      setLoading(false);
    }

    loadStats();
  }, [router]);

  const metrics = useMemo(() => {
    const completadas = bookings.filter(
      (b) => getBookingEstado(b) === "completada",
    );
    const ingresosNetos = completadas.reduce(
      (sum, b) => sum + getNetIncome(b.precio_total),
      0,
    );
    const valoracionMedia =
      reviews.length > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.valoracion), 0) /
            reviews.length
          ).toFixed(1)
        : "—";

    return {
      totalReservas: bookings.length,
      completadas: completadas.length,
      ingresosNetos,
      valoracionMedia,
    };
  }, [bookings, reviews]);

  const monthlyData = useMemo(() => {
    const months = getLast6Months();
    const counts = {};

    for (const month of months) {
      counts[month.key] = 0;
    }

    for (const booking of bookings) {
      if (!booking.created_at) continue;
      const d = new Date(booking.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in counts) {
        counts[key] += 1;
      }
    }

    return months.map((month) => ({
      ...month,
      count: counts[month.key],
    }));
  }, [bookings]);

  const maxMonthlyCount = useMemo(
    () => Math.max(...monthlyData.map((m) => m.count), 1),
    [monthlyData],
  );

  const servicesStats = useMemo(() => {
    const serviceMap = Object.fromEntries(
      services.map((s) => [
        s.id,
        {
          id: s.id,
          titulo: s.titulo || "Servicio",
          reservas: 0,
          ingresos: 0,
          ratings: [],
        },
      ]),
    );

    for (const booking of bookings) {
      const entry = serviceMap[booking.service_id];
      if (!entry) continue;
      entry.reservas += 1;
      if (getBookingEstado(booking) === "completada") {
        entry.ingresos += getNetIncome(booking.precio_total);
      }
    }

    for (const review of reviews) {
      const entry = serviceMap[review.service_id];
      if (!entry) continue;
      entry.ratings.push(Number(review.valoracion));
    }

    return Object.values(serviceMap)
      .map((entry) => ({
        ...entry,
        valoracionMedia:
          entry.ratings.length > 0
            ? (
                entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length
              ).toFixed(1)
            : "—",
      }))
      .sort((a, b) => b.reservas - a.reservas);
  }, [services, bookings, reviews]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    for (const booking of bookings) {
      const estado = getBookingEstado(booking);
      if (estado in counts) {
        counts[estado] += 1;
      }
    }
    return counts;
  }, [bookings]);

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando estadísticas…
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
        className="px-4 py-6 text-white sm:px-6"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="text-sm text-white/80 no-underline transition-opacity hover:opacity-100"
          >
            ← Volver al dashboard
          </Link>
          <h1
            className="mt-2 text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Estadísticas
          </h1>
          <p className="mt-1 text-sm text-white/80">
            Resumen de tu actividad como proveedor
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total reservas recibidas"
            value={metrics.totalReservas}
          />
          <MetricCard
            label="Reservas completadas"
            value={metrics.completadas}
          />
          <MetricCard
            label="Ingresos netos totales"
            value={formatEuro(metrics.ingresosNetos)}
            sublabel="Tras comisiones"
          />
          <MetricCard
            label="Valoración media"
            value={
              metrics.valoracionMedia === "—"
                ? "—"
                : `${metrics.valoracionMedia} ★`
            }
            sublabel={
              reviews.length > 0
                ? `${reviews.length} valoración${reviews.length > 1 ? "es" : ""}`
                : "Sin valoraciones"
            }
          />
        </div>

        <section
          className="rounded-2xl border bg-white p-6"
          style={{ borderColor: BRAND.border }}
        >
          <h2
            className="text-lg font-semibold text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Reservas por mes
          </h2>
          <p className="mt-1 text-xs text-[#888]">Últimos 6 meses</p>

          <div className="mt-6 grid grid-cols-6 gap-2 sm:gap-4">
            {monthlyData.map((month) => {
              const heightPct = (month.count / maxMonthlyCount) * 100;
              return (
                <div key={month.key} className="flex flex-col items-center">
                  <span
                    className="text-sm font-bold"
                    style={{ color: BRAND.primary }}
                  >
                    {month.count}
                  </span>
                  <div className="mt-2 flex h-36 w-full items-end justify-center sm:h-40">
                    <div
                      className="w-full max-w-12 rounded-t-lg transition-all"
                      style={{
                        height: `${Math.max(heightPct, month.count > 0 ? 12 : 4)}%`,
                        minHeight: month.count > 0 ? "12px" : "4px",
                        backgroundColor: "#1d4f91",
                      }}
                    />
                  </div>
                  <span className="mt-2 text-center text-[10px] capitalize text-[#888] sm:text-xs">
                    {month.label}
                  </span>
                </div>
              );
            })}
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
            Servicios más reservados
          </h2>

          {servicesStats.length === 0 ? (
            <p className="mt-4 text-sm text-[#666]">
              Aún no tienes servicios publicados.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr
                    className="border-b text-xs font-semibold uppercase tracking-wide text-[#888]"
                    style={{ borderColor: BRAND.border }}
                  >
                    <th className="px-3 py-3">Servicio</th>
                    <th className="px-3 py-3 text-right">Reservas</th>
                    <th className="px-3 py-3 text-right">Ingresos</th>
                    <th className="px-3 py-3 text-right">Valoración</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesStats.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: BRAND.border }}
                    >
                      <td className="px-3 py-3 font-medium text-[#1a1a1a]">
                        {service.titulo}
                      </td>
                      <td
                        className="px-3 py-3 text-right font-semibold"
                        style={{ color: BRAND.primary }}
                      >
                        {service.reservas}
                      </td>
                      <td className="px-3 py-3 text-right text-[#444]">
                        {formatEuro(service.ingresos)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#444]">
                        {service.valoracionMedia === "—"
                          ? "—"
                          : `${service.valoracionMedia} ★`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section
            className="rounded-2xl border bg-white p-6"
            style={{ borderColor: BRAND.border }}
          >
            <h2
              className="text-lg font-semibold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              Resumen por estado
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {STATUS_ORDER.map((status) => (
                <li
                  key={status}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{ borderColor: BRAND.border }}
                >
                  <StatusBadge status={status} />
                  <span
                    className="text-xl font-bold"
                    style={{ color: BRAND.primary }}
                  >
                    {statusCounts[status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-2xl border bg-white p-6"
            style={{ borderColor: BRAND.border }}
          >
            <h2
              className="text-lg font-semibold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              Visitas al perfil
            </h2>
            <p className="mt-4 rounded-xl bg-[#f7f5f2] px-4 py-6 text-center text-sm leading-relaxed text-[#666]">
              Las estadísticas de visitas estarán disponibles próximamente.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
