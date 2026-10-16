"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import DataLoadFailed from "@/app/components/DataLoadFailed";
import { BRAND, SERIF } from "@/app/components/brand";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";
import { supabase } from "@/app/lib/supabase";
import { friendlyLoadError, withLoadTimeout } from "@/app/lib/with-load-timeout";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

const VERTICAL_COLORS = {
  alojamiento: PRIMARY,
  ninos: "#0e7a5c",
  mascotas: "#c47d1a",
};

const STATUS_ORDER = ["completada", "confirmada", "pendiente", "en_curso", "cancelada"];

function getReservasSinComisionProveedor(perfil) {
  return Number(perfil?.reservas_sin_comision_proveedor) || 0;
}

function getBookingEstado(booking) {
  const estado = booking.estado ?? booking.status ?? "pendiente";
  if (estado === "cancelada_garantia") return "cancelada";
  return estado;
}

function sumPendienteDeCobrar(bookings, sinComisionProveedor) {
  return bookings
    .filter((b) => {
      if (isExcludedFromMoney(b) || b.pago_liberado_at != null) return false;
      const estado = getBookingEstado(b);
      return estado === "confirmada" || estado === "en_curso";
    })
    .reduce(
      (sum, b) =>
        sum +
        getIngresoProveedorFromBooking(b, { sinComisionProveedor }),
      0,
    );
}

const MONEY_EXCLUDED_ESTADOS = new Set([
  "cancelada",
  "cancelada_garantia",
  "cancelada_proveedor",
  "rechazada",
  "incidencia",
]);

const RESERVAS_EXCLUDED_ESTADOS = new Set(["rechazada", "cancelada_proveedor"]);

function getRawEstado(booking) {
  return booking.estado ?? booking.status ?? "pendiente";
}

function isExcludedFromMoney(booking) {
  return MONEY_EXCLUDED_ESTADOS.has(getRawEstado(booking));
}

function isExcludedFromReservasCount(booking) {
  return RESERVAS_EXCLUDED_ESTADOS.has(getRawEstado(booking));
}

function sumCobrado(bookings) {
  return bookings
    .filter((b) => !isExcludedFromMoney(b) && b.pago_liberado_at != null)
    .reduce((sum, b) => sum + (Number(b.importe_transferido) || 0), 0);
}

function formatEuro(value) {
  return `${Number(value).toFixed(2)}€`;
}

function formatEuroRounded(value) {
  return `${Math.round(Number(value)).toLocaleString("es-ES")}€`;
}

function getPeriodDays(period) {
  const map = { "7d": 7, "30d": 30, "3m": 90 };
  return map[period] ?? null;
}

function isInRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d < end;
}

function filterByPeriod(items, period, dateField = "created_at") {
  const days = getPeriodDays(period);
  if (!days) return items;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return items.filter((item) => isInRange(item[dateField], start, end));
}

function filterPreviousPeriod(items, period, dateField = "created_at") {
  const days = getPeriodDays(period);
  if (!days) return [];
  const currentEnd = new Date();
  const currentStart = new Date();
  currentStart.setDate(currentEnd.getDate() - days);
  const prevEnd = currentStart;
  const prevStart = new Date();
  prevStart.setDate(prevEnd.getDate() - days);
  return items.filter((item) => isInRange(item[dateField], prevStart, prevEnd));
}

function calcTrend(current, previous, T) {
  const sinCambio = T?.sinCambio ?? "Sin cambio";
  const nuevo = T?.nuevo ?? "Nuevo";
  const tendencia = T?.tendencia ?? ((dir, pct) => `${dir} ${pct}% vs período anterior`);

  if (previous === 0) {
    if (current === 0) return { label: sinCambio, up: null };
    return { label: nuevo, up: true };
  }
  const diff = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(diff));
  if (Math.abs(diff) < 0.5) return { label: sinCambio, up: null };
  return {
    label: tendencia(diff >= 0 ? "↑" : "↓", rounded),
    up: diff >= 0,
  };
}

function getLast6Months(locale = "es-ES") {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(locale, { month: "short" }),
    });
  }
  return months;
}

function StatCard({ label, value, sublabel, trend }) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: BORDER }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-widest text-[#bbb]">
        {label}
      </p>
      <p
        className="mt-2 text-[26px]"
        style={{ color: PRIMARY, fontWeight: 200 }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1 text-[11px] text-[#888]">{sublabel}</p>}
      {trend && (
        <p
          className="mt-2 text-[10px] font-medium"
          style={{
            color: trend.up === null ? "#888" : trend.up ? "#0e7a5c" : "#dc2626",
          }}
        >
          {trend.label}
        </p>
      )}
    </div>
  );
}

function Stars({ value, size = 14 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="tracking-wide" style={{ color: "#c8922a", fontSize: size }}>
      {"★".repeat(rounded)}
      {"☆".repeat(Math.max(0, 5 - rounded))}
    </span>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const { lang } = useLang();
  const t = useTranslation(lang);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [period, setPeriod] = useState("30d");
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [sinComisionProveedor, setSinComisionProveedor] = useState(false);

  const STATUS_META = useMemo(() => ({
    completada: { label: t.estadisticas.statusCompletadas, color: "#0e7a5c" },
    confirmada: { label: t.estadisticas.statusConfirmadas, color: PRIMARY },
    pendiente: { label: t.estadisticas.statusPendientes, color: "#c47d1a" },
    en_curso: { label: t.estadisticas.statusEnCurso, color: "#7c3aed" },
    cancelada: { label: t.estadisticas.statusCanceladas, color: "#dc2626" },
  }), [t]);

  const periodTabs = useMemo(() => [
    { id: "7d", label: t.estadisticas.periodo7d },
    { id: "30d", label: t.estadisticas.periodo30d },
    { id: "3m", label: t.estadisticas.periodo3m },
    { id: "todo", label: t.estadisticas.periodoTodo },
  ], [t]);

  useEffect(() => {
    let cancelled = false;
    let navigatedAway = false;

    async function loadStats() {
      setLoading(true);
      setLoadError("");
      try {
        await withLoadTimeout((async () => {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            navigatedAway = true;
            router.replace("/login");
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role, reservas_sin_comision_proveedor")
            .eq("id", user.id)
            .single();
          if (profileError) throw profileError;

          if (profile?.role !== "proveedor") {
            navigatedAway = true;
            router.replace("/dashboard?tab=cliente");
            return;
          }
          if (cancelled) return;

          setSinComisionProveedor(getReservasSinComisionProveedor(profile) > 0);

          const { data: servicesData, error: servicesError } = await supabase
            .from("services")
            .select("id, titulo, vertical")
            .eq("proveedor_id", user.id);
          if (servicesError) throw servicesError;
          if (cancelled) return;

          const providerServices = servicesData ?? [];
          setServices(providerServices);

          const serviceIds = providerServices.map((s) => s.id);
          if (serviceIds.length > 0) {
            const { data: bookingsData, error: bookingsError } = await supabase
              .from("bookings")
              .select(
                "id, service_id, precio_total, precio_base, cliente_sin_comision, proveedor_sin_comision, estado, created_at, pago_liberado_at, importe_transferido",
              )
              .in("service_id", serviceIds);
            if (bookingsError) throw bookingsError;
            if (cancelled) return;
            setBookings(bookingsData ?? []);
          } else {
            setBookings([]);
          }

          const { data: reviewsData, error: reviewsError } = await supabase
            .from("reviews")
            .select("valoracion, service_id, created_at")
            .eq("proveedor_id", user.id);
          if (reviewsError) throw reviewsError;
          if (cancelled) return;
          setReviews(reviewsData ?? []);
        })());
      } catch (err) {
        if (!cancelled && !navigatedAway) {
          setLoadError(friendlyLoadError(err));
        }
      } finally {
        if (!cancelled && !navigatedAway) setLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  const periodBookings = useMemo(
    () => filterByPeriod(bookings, period),
    [bookings, period],
  );

  const prevPeriodBookings = useMemo(
    () => filterPreviousPeriod(bookings, period),
    [bookings, period],
  );

  const periodReviews = useMemo(
    () => filterByPeriod(reviews, period),
    [reviews, period],
  );

  const prevPeriodReviews = useMemo(
    () => filterPreviousPeriod(reviews, period),
    [reviews, period],
  );

  const metrics = useMemo(() => {
    const reservasReales = periodBookings.filter(
      (b) => !isExcludedFromReservasCount(b),
    );
    const prevReservasReales = prevPeriodBookings.filter(
      (b) => !isExcludedFromReservasCount(b),
    );

    const ingresosNetos = sumCobrado(periodBookings);
    const prevIngresosNetos = sumCobrado(prevPeriodBookings);

    const pendienteDeCobrar = sumPendienteDeCobrar(
      periodBookings,
      sinComisionProveedor,
    );

    const cobrado = ingresosNetos;
    const totalEstimado = cobrado + pendienteDeCobrar;
    const porcentajeCobrado =
      totalEstimado > 0 ? Math.round((cobrado / totalEstimado) * 100) : 0;

    const valoracionMedia =
      periodReviews.length > 0
        ? periodReviews.reduce((sum, r) => sum + Number(r.valoracion), 0) /
          periodReviews.length
        : null;

    const prevValoracionMedia =
      prevPeriodReviews.length > 0
        ? prevPeriodReviews.reduce((sum, r) => sum + Number(r.valoracion), 0) /
          prevPeriodReviews.length
        : null;

    const completadas = reservasReales.filter(
      (b) => getBookingEstado(b) === "completada",
    );
    const prevCompletadas = prevReservasReales.filter(
      (b) => getBookingEstado(b) === "completada",
    );

    const tasaConversion =
      reservasReales.length > 0
        ? (completadas.length / reservasReales.length) * 100
        : 0;

    const prevTasaConversion =
      prevReservasReales.length > 0
        ? (prevCompletadas.length / prevReservasReales.length) * 100
        : 0;

    return {
      ingresosNetos,
      prevIngresosNetos,
      totalReservas: reservasReales.length,
      prevTotalReservas: prevReservasReales.length,
      valoracionMedia,
      prevValoracionMedia,
      tasaConversion,
      prevTasaConversion,
      cobrado,
      pendienteDeCobrar,
      totalEstimado,
      porcentajeCobrado,
      reviewCount: periodReviews.length,
    };
  }, [periodBookings, prevPeriodBookings, periodReviews, prevPeriodReviews, sinComisionProveedor]);

  const trends = useMemo(() => {
    const showTrend = period !== "todo";
    const T = t.estadisticas;
    return {
      ingresos: showTrend
        ? calcTrend(metrics.ingresosNetos, metrics.prevIngresosNetos, T)
        : null,
      reservas: showTrend
        ? calcTrend(metrics.totalReservas, metrics.prevTotalReservas, T)
        : null,
      valoracion:
        showTrend && metrics.valoracionMedia != null && metrics.prevValoracionMedia != null
          ? calcTrend(metrics.valoracionMedia, metrics.prevValoracionMedia, T)
          : showTrend && metrics.valoracionMedia != null && metrics.prevValoracionMedia == null
            ? { label: T.nuevo, up: true }
            : null,
      conversion: showTrend
        ? calcTrend(metrics.tasaConversion, metrics.prevTasaConversion, T)
        : null,
    };
  }, [metrics, period, t]);

  const monthlyData = useMemo(() => {
    const locale = lang === "en" ? "en-GB" : "es-ES";
    const months = getLast6Months(locale);
    const counts = Object.fromEntries(months.map((m) => [m.key, 0]));

    for (const booking of periodBookings) {
      if (isExcludedFromReservasCount(booking)) continue;
      if (!booking.created_at) continue;
      const d = new Date(booking.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in counts) counts[key] += 1;
    }

    return months.map((month) => ({
      ...month,
      count: counts[month.key],
    }));
  }, [periodBookings, lang]);

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
          vertical: s.vertical,
          reservas: 0,
          ingresos: 0,
        },
      ]),
    );

    for (const booking of periodBookings) {
      const entry = serviceMap[booking.service_id];
      if (!entry) continue;
      if (!isExcludedFromReservasCount(booking)) {
        entry.reservas += 1;
      }
      if (
        !isExcludedFromMoney(booking) &&
        booking.pago_liberado_at != null
      ) {
        entry.ingresos += Number(booking.importe_transferido) || 0;
      }
    }

    return Object.values(serviceMap)
      .filter((s) => s.reservas > 0)
      .sort((a, b) => b.reservas - a.reservas);
  }, [services, periodBookings]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    for (const booking of periodBookings) {
      const estado = getBookingEstado(booking);
      if (estado in counts) counts[estado] += 1;
    }
    return counts;
  }, [periodBookings]);

  const ratingDistribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of periodReviews) {
      const star = Math.round(Number(review.valoracion));
      if (star >= 1 && star <= 5) dist[star] += 1;
    }
    const max = Math.max(...Object.values(dist), 1);
    return { dist, max };
  }, [periodReviews]);

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="px-6 py-16 text-center text-sm text-[#666]">
          {t.estadisticas.cargando}
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <DataLoadFailed
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  const valoracionDisplay =
    metrics.valoracionMedia != null
      ? metrics.valoracionMedia.toFixed(1)
      : "—";

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <header className="border-b bg-white px-6 py-6" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-5xl">
          <h1
            className="text-[22px] text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t.estadisticas.titulo}
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            {t.estadisticas.subtitulo}
          </p>
        </div>
      </header>

      <div
        className="border-b bg-white px-6 py-4"
        style={{ borderColor: BORDER }}
      >
        <div className="mx-auto flex flex-wrap gap-2 max-w-5xl">
          {periodTabs.map((tab) => {
            const isActive = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className="rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? PRIMARY : "#fff",
                  color: isActive ? "#fff" : "#666",
                  border: isActive ? `1px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t.estadisticas.ingresosNetos}
            value={formatEuro(metrics.ingresosNetos)}
            sublabel={t.estadisticas.ingresosSubtitulo}
            trend={trends.ingresos}
          />
          <StatCard
            label={t.estadisticas.reservasRecibidas}
            value={metrics.totalReservas}
            sublabel={t.estadisticas.reservasSubtitulo}
            trend={trends.reservas}
          />
          <StatCard
            label={t.estadisticas.valoracionMedia}
            value={valoracionDisplay === "—" ? "—" : `${valoracionDisplay} ★`}
            sublabel={
              metrics.reviewCount > 0
                ? t.estadisticas.valoracionCount(metrics.reviewCount)
                : t.estadisticas.sinValoraciones
            }
            trend={trends.valoracion}
          />
          <StatCard
            label={t.estadisticas.tasaConversion}
            value={`${metrics.tasaConversion.toFixed(0)}%`}
            sublabel={t.estadisticas.tasaSubtitulo}
            trend={trends.conversion}
          />
        </div>

        <div
          className="rounded-xl px-6 py-5 text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60">
                {t.estadisticas.cobrado}
              </p>
              <p className="mt-0.5 text-lg font-medium">{formatEuroRounded(metrics.cobrado)}</p>
            </div>
            <div className="hidden h-8 w-px bg-white/20 sm:block" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60">
                {t.estadisticas.pendienteCobrar}
              </p>
              <p className="mt-0.5 text-lg font-medium">{formatEuroRounded(metrics.pendienteDeCobrar)}</p>
            </div>
          </div>

          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${metrics.porcentajeCobrado}%`,
                  backgroundColor: "#fff",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-white/70">
              {t.estadisticas.totalEstimado}{" "}
              <span className="font-semibold text-white">
                {formatEuroRounded(metrics.totalEstimado)}
              </span>
              {" · "}
              {t.estadisticas.pctCobrado(metrics.porcentajeCobrado)}
            </p>
          </div>
        </div>

        <section
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: BORDER }}
        >
          <h2 className="text-sm font-semibold text-[#1a1a1a]">{t.estadisticas.reservasPorMes}</h2>
          <p className="mt-0.5 text-[10px] text-[#888]">{t.estadisticas.ultimos6Meses}</p>

          <div className="mt-5 grid grid-cols-6 gap-2 sm:gap-3">
            {monthlyData.map((month) => {
              const heightPct = (month.count / maxMonthlyCount) * 100;
              return (
                <div key={month.key} className="flex flex-col items-center">
                  <span
                    className="text-xs font-medium"
                    style={{ color: PRIMARY }}
                  >
                    {month.count}
                  </span>
                  <div className="mt-1 flex h-28 w-full items-end justify-center sm:h-32">
                    <div
                      className="w-full max-w-10 rounded-t"
                      style={{
                        height: `${Math.max(heightPct, month.count > 0 ? 10 : 3)}%`,
                        minHeight: month.count > 0 ? 10 : 3,
                        backgroundColor: PRIMARY,
                      }}
                    />
                  </div>
                  <span className="mt-1.5 text-center text-[10px] capitalize text-[#888]">
                    {month.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: BORDER }}
        >
          <h2 className="text-sm font-semibold text-[#1a1a1a]">
            {t.estadisticas.serviciosMasReservados}
          </h2>

          {servicesStats.length === 0 ? (
            <p className="mt-4 text-sm text-[#666]">
              {t.estadisticas.sinReservasPeriodo}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead>
                  <tr
                    className="border-b text-[10px] font-semibold uppercase tracking-wide text-[#bbb]"
                    style={{ borderColor: BORDER }}
                  >
                    <th className="px-2 py-2">{t.estadisticas.thServicio}</th>
                    <th className="px-2 py-2 text-right">{t.estadisticas.thReservas}</th>
                    <th className="px-2 py-2 text-right">{t.estadisticas.thIngresos}</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesStats.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: BORDER }}
                    >
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                VERTICAL_COLORS[service.vertical] || PRIMARY,
                            }}
                          />
                          <span className="font-medium text-[#1a1a1a]">
                            {service.titulo}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 text-right font-medium"
                        style={{ color: PRIMARY }}
                      >
                        {service.reservas}
                      </td>
                      <td className="px-2 py-3 text-right text-[#444]">
                        {formatEuro(service.ingresos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section
            className="rounded-xl border bg-white p-5"
            style={{ borderColor: BORDER }}
          >
            <h2 className="text-sm font-semibold text-[#1a1a1a]">{t.estadisticas.porEstado}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {STATUS_ORDER.map((status) => {
                const meta = STATUS_META[status];
                return (
                  <li
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-sm text-[#444]">{meta.label}</span>
                    </div>
                    <span
                      className="text-lg font-medium"
                      style={{ color: PRIMARY, fontWeight: 200 }}
                    >
                      {statusCounts[status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="rounded-xl border bg-white p-5"
            style={{ borderColor: BORDER }}
          >
            <h2 className="text-sm font-semibold text-[#1a1a1a]">{t.estadisticas.seccionValoraciones}</h2>
            {periodReviews.length === 0 ? (
              <p className="mt-4 text-sm text-[#666]">{t.estadisticas.sinValoracionesAun}</p>
            ) : (
              <div className="mt-4">
                <p
                  className="text-[32px]"
                  style={{ color: PRIMARY, fontWeight: 200 }}
                >
                  {valoracionDisplay}
                </p>
                <Stars value={metrics.valoracionMedia} size={16} />
                <ul className="mt-4 flex flex-col gap-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingDistribution.dist[star];
                    const widthPct = (count / ratingDistribution.max) * 100;
                    return (
                      <li key={star} className="flex items-center gap-2">
                        <span className="w-3 text-[10px] text-[#888]">{star}</span>
                        <span className="text-[10px] text-[#c8922a]">★</span>
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full"
                          style={{ backgroundColor: "#f0ede8" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: PRIMARY,
                              minWidth: count > 0 ? 4 : 0,
                            }}
                          />
                        </div>
                        <span className="w-4 text-right text-[10px] text-[#888]">
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section
            className="rounded-xl border bg-white p-5"
            style={{ borderColor: BORDER }}
          >
            <h2 className="text-sm font-semibold text-[#1a1a1a]">{t.estadisticas.visitas}</h2>
            <p className="mt-6 rounded-lg bg-[#f7f5f2] px-4 py-8 text-center text-sm text-[#888]">
              {t.estadisticas.proximamente}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
