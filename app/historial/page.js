"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  BOOKING_VERTICAL_META,
  formatBookingPrice,
  getBookingDateRangeLabel,
  getBookingDurationLabel,
  getBookingEstado,
  getBookingMonthKey,
  getBookingMonthLabel,
  getBookingStatusMeta,
  getCancelRefundBreakdown,
  isCanceladoEstado,
} from "@/app/lib/booking-display";
import { ActionToastHost, useActionToast } from "@/app/components/ActionToast";
import BookingStatusBadge from "@/app/components/BookingStatusBadge";
import DataLoadFailed from "@/app/components/DataLoadFailed";
import EmptyState from "@/app/components/EmptyState";
import AyudaLink from "@/app/components/AyudaLink";
import ReportarIncidenciaForm from "@/app/components/ReportarIncidenciaForm";
import ProveedorPreguntarButton from "@/app/components/ProveedorPreguntarButton";
import { canLeaveReview } from "@/app/lib/reviews";
import { buildLoginUrl } from "@/app/lib/auth-redirect";
import { supabase } from "@/app/lib/supabase";
import { friendlyLoadError, withLoadTimeout } from "@/app/lib/with-load-timeout";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";
const BORDER = "#e8e4de";

function getExtraTags(service, vertical) {
  const tags = [];
  const proveedor = service.profiles_public ?? {};
  const idiomas = Array.isArray(proveedor.idiomas) ? proveedor.idiomas : [];

  if (vertical === "alojamiento") tags.push("NRU ✓");
  if (vertical === "mascotas" || vertical === "alojamiento") tags.push("Pet-friendly");
  if (idiomas.some((l) => /english/i.test(l))) {
    tags.push(idiomas.some((l) => /native/i.test(l)) ? "English native" : "English fluent");
  }
  return tags;
}

function ExtraTag({ label }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: "#f7f5f2", color: "#666" }}
    >
      {label}
    </span>
  );
}

function StatItem({ label, value, showDivider }) {
  return (
    <>
      {showDivider && (
        <div className="hidden h-8 w-px sm:block" style={{ backgroundColor: BORDER }} />
      )}
      <div className="flex flex-col items-center px-4 py-2 sm:px-6">
        <span className="text-[20px] font-extralight" style={{ color: PRIMARY, fontWeight: 200 }}>
          {value}
        </span>
        <span className="mt-0.5 text-[10px] text-[#888]">{label}</span>
      </div>
    </>
  );
}

function GrayButton({ children, onClick, href, disabled }) {
  const className =
    "rounded-md border px-3 py-1.5 text-[11px] font-medium text-[#666] no-underline transition-colors hover:bg-[#f7f5f2] disabled:opacity-60";
  const style = { borderColor: BORDER, backgroundColor: "#fff" };
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} style={style}>
      {children}
    </button>
  );
}

function BookingCard({
  booking,
  reviewed,
  onCancel,
  cancelling,
  onIncidenciaReported,
  t,
}) {
  const estado = getBookingEstado(booking);
  const statusMeta = getBookingStatusMeta(booking.estado || estado, {
    role: "cliente",
  });
  const service = booking.services ?? {};
  const proveedor = service.profiles_public ?? {};
  const vertical = service.vertical ?? "alojamiento";
  const vMeta = BOOKING_VERTICAL_META[vertical] ?? BOOKING_VERTICAL_META.alojamiento;
  const proveedorNombre =
    [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") || "Proveedor";
  const zona = service.ciudad || "—";
  const duration = getBookingDurationLabel(booking, vertical);
  const personas =
    booking.num_huespedes != null
      ? `${booking.num_huespedes} ${
          booking.num_huespedes === 1 ? "pers." : "pers."
        }`
      : null;
  const metaParts = [getBookingDateRangeLabel(booking), duration, personas].filter(Boolean);
  const extraTags = getExtraTags(service, vertical);
  const refundBreakdown = getCancelRefundBreakdown(booking);
  const reviewEligible =
    estado === "completada" &&
    canLeaveReview(booking, { hasReview: reviewed }).ok;

  return (
    <article
      className="flex gap-3 rounded-xl border bg-white p-4"
      style={{ borderColor: BORDER }}
    >
      <div
        className="h-[52px] w-16 shrink-0"
        style={{ borderRadius: 7, background: vMeta.gradient }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-[#1a1a1a]">
            {service.titulo || "Servicio Home&Heart"}
          </p>
          <div className="shrink-0 text-right">
            {refundBreakdown ? (
              <>
                <p className="text-[13px] font-semibold" style={{ color: PRIMARY }}>
                  {t.historial.pagas} {formatBookingPrice(refundBreakdown.importeFinal)}
                </p>
                <p className="mt-0.5 text-[10px] font-medium" style={{ color: GREEN }}>
                  {t.historial.devolucion} {formatBookingPrice(refundBreakdown.reembolsoTotal)} (
                  {refundBreakdown.reembolsoPct}%)
                </p>
                {refundBreakdown.reembolsoCredito > 0 && (
                  <p className="mt-0.5 text-[10px] font-medium" style={{ color: GREEN }}>
                    +{formatBookingPrice(refundBreakdown.reembolsoCredito)} {t.historial.atuCredito}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] font-medium" style={{ color: PRIMARY }}>
                {formatBookingPrice(booking.precio_total)}
              </p>
            )}
          </div>
        </div>

        <p className="mt-0.5 text-[11px] text-[#888]">
          {proveedorNombre} · {vMeta.label} · {zona}
        </p>

        <p className="mt-1 text-[10px] text-[#aaa]">
          {metaParts.join(" · ")}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <BookingStatusBadge
            status={booking.estado || estado}
            role="cliente"
            size="sm"
          />
          {extraTags.map((tag) => (
            <ExtraTag key={tag} label={tag} />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[#888]">
          {statusMeta.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <GrayButton href={`/reserva/${booking.id}`}>{t.historial.verDetalle}</GrayButton>

          {statusMeta.actions.includes("mensaje") && service.proveedor_id ? (
            <ProveedorPreguntarButton
              proveedorId={service.proveedor_id}
              className="rounded-md border px-3 py-1.5 text-[11px] font-medium no-underline transition-colors hover:bg-[#f7f5f2] disabled:opacity-60"
              style={{
                borderColor: BORDER,
                backgroundColor: "#fff",
                color: "#666",
              }}
            >
              {t.historial.enviarMensaje}
            </ProveedorPreguntarButton>
          ) : null}

          {estado === "completada" && (
            <>
              <a
                href={`/api/facturas/${booking.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white no-underline"
                style={{ backgroundColor: "#0e7a5c" }}
              >
                {t.historial.descargarFactura}
              </a>
              {reviewed ? (
                <span
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-medium"
                  style={{ backgroundColor: "#f0f4f8", color: "#0e7a5c" }}
                >
                  {t.historial.resenada}
                </span>
              ) : reviewEligible ? (
                <Link
                  href={`/resena/${booking.id}`}
                  className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white no-underline"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {t.historial.dejarResena}
                </Link>
              ) : null}
            </>
          )}

          {(estado === "confirmada" || estado === "pendiente") && (
            <GrayButton
              onClick={() => onCancel(booking)}
              disabled={cancelling === booking.id}
            >
              {cancelling === booking.id ? t.historial.cancelando : t.historial.cancelar}
            </GrayButton>
          )}

          {statusMeta.canReportIncidencia && (
            <div className="w-full">
              <p className="mb-1.5 text-[11px] font-semibold text-[#666]">
                {t.historial.problemaReserva}
              </p>
              <ReportarIncidenciaForm
                bookingId={booking.id}
                compact
                onSuccess={() => onIncidenciaReported?.(booking.id)}
              />
            </div>
          )}
          <AyudaLink
            label={t.historial.ayudaGeneral}
            style={{ marginTop: 4, fontSize: 11 }}
          />
        </div>
      </div>
    </article>
  );
}

export default function HistorialPage() {
  const router = useRouter();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const { toast, showSuccess, showError, dismiss } = useActionToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [activeFilter, setActiveFilter] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [creditoDisponible, setCreditoDisponible] = useState(0);

  const filterTabs = useMemo(() => [
    { id: "todas", label: t.historial.filtroTodas },
    { id: "pendiente", label: t.historial.filtroPendientes },
    { id: "confirmada", label: t.historial.filtroConfirmadas },
    { id: "en_curso", label: t.historial.filtroEnCurso },
    { id: "completada", label: t.historial.filtroCompletadas },
    { id: "incidencia", label: t.historial.filtroIncidencias },
    { id: "cancelada", label: t.historial.filtroCanceladas },
  ], [t]);

  useEffect(() => {
    let cancelled = false;
    let navigatedAway = false;

    async function loadHistorial() {
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
            router.replace(buildLoginUrl("/historial"));
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("credito_disponible")
            .eq("id", user.id)
            .maybeSingle();
          if (profileError) throw profileError;
          if (cancelled) return;

          setCreditoDisponible(Number(profile?.credito_disponible) || 0);

          const { data: bookingsData, error: bookingsError } = await supabase
            .from("bookings")
            .select(
              `
              *,
              services:service_id (
                titulo,
                vertical,
                precio,
                ciudad,
                proveedor_id,
                profiles_public:proveedor_id (nombre, apellido, idiomas)
              )
            `,
            )
            .eq("cliente_id", user.id)
            .order("created_at", { ascending: false });

          if (bookingsError) throw bookingsError;
          if (cancelled) return;

          const rows = bookingsData ?? [];
          setBookings(rows);

          if (rows.length > 0) {
            const { data: reviews, error: reviewsError } = await supabase
              .from("reviews")
              .select("booking_id")
              .in("booking_id", rows.map((b) => b.id));
            if (reviewsError) throw reviewsError;
            if (cancelled) return;
            setReviewedIds(new Set((reviews ?? []).map((r) => r.booking_id)));
          } else {
            setReviewedIds(new Set());
          }
        })());
      } catch (err) {
        if (!cancelled && !navigatedAway) {
          setLoadError(friendlyLoadError(err));
          setBookings([]);
        }
      } finally {
        if (!cancelled && !navigatedAway) setLoading(false);
      }
    }

    loadHistorial();
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const completadas = bookings.filter((b) => getBookingEstado(b) === "completada").length;
    const activas = bookings.filter((b) =>
      ["confirmada", "pendiente", "en_curso"].includes(getBookingEstado(b)),
    ).length;
    const totalGastado = bookings
      .filter((b) => getBookingEstado(b) === "completada")
      .reduce((sum, b) => sum + (Number(b.precio_total) || 0), 0);
    return { total, completadas, activas, totalGastado };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (activeFilter !== "todas") {
      result = result.filter((b) => {
        const estado = getBookingEstado(b);
        if (activeFilter === "cancelada") return isCanceladoEstado(estado);
        if (activeFilter === "incidencia") {
          return estado === "incidencia" || estado === "incidencia_resuelta";
        }
        return estado === activeFilter;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((booking) => {
        const service = booking.services ?? {};
        const proveedor = service.profiles_public ?? {};
        const titulo = (service.titulo || "").toLowerCase();
        const proveedorNombre = [proveedor.nombre, proveedor.apellido]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return titulo.includes(q) || proveedorNombre.includes(q);
      });
    }

    return result;
  }, [bookings, activeFilter, searchQuery]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map();
    for (const booking of filteredBookings) {
      const key = getBookingMonthKey(booking);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(booking);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredBookings]);

  async function handleCancel(booking) {
    if (!window.confirm(t.historial.confirmarCancelar)) return;

    setCancellingId(booking.id);
    setErrorMessage("");

    const res = await fetch("/api/bookings/cancelar-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: booking.id }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      const reembolso = data.reembolso ?? {};
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                estado: data.estado,
                reembolso_cliente_pct: reembolso.pct ?? null,
                reembolso_cliente_total:
                  reembolso.bruto != null ? reembolso.bruto : null,
                reembolso_cliente_credito:
                  reembolso.credito != null ? reembolso.credito : null,
              }
            : b,
        ),
      );
      const creditoDevuelto = Number(reembolso.credito) || 0;
      if (creditoDevuelto > 0) {
        setCreditoDisponible(
          (prev) => Math.round((prev + creditoDevuelto) * 100) / 100,
        );
      }
      showSuccess(t.historial.canceladaOk);
    } else {
      const msg = data.error || t.historial.canceladaError;
      setErrorMessage(msg);
      showError(msg);
    }

    setCancellingId(null);
  }

  function handleIncidenciaReported(bookingId) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, estado: "incidencia" } : b,
      ),
    );
    showSuccess(t.historial.incidenciaEnviada);
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="px-7 py-16 text-center text-sm text-[#666]">
          {t.historial.cargando}
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

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <header className="border-b bg-white px-4 py-5 sm:px-6 sm:py-6" style={{ borderColor: BORDER }}>
        <div className="mx-auto" style={{ maxWidth: 900 }}>
          <h1
            className="text-[22px] text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t.historial.titulo}
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            {t.historial.subtitulo}
          </p>
        </div>
      </header>

      <div className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div
          className="mx-auto flex flex-wrap items-center justify-center"
          style={{ maxWidth: 900 }}
        >
          <StatItem label={t.historial.statTotal} value={stats.total} showDivider={false} />
          <StatItem label={t.historial.statCompletadas} value={stats.completadas} showDivider />
          <StatItem label={t.historial.statActivas} value={stats.activas} showDivider />
          <StatItem
            label={t.historial.statGastado}
            value={formatBookingPrice(stats.totalGastado)}
            showDivider
          />
          {creditoDisponible > 0 && (
            <StatItem
              label={t.historial.statCredito}
              value={formatBookingPrice(creditoDisponible)}
              showDivider
            />
          )}
        </div>
      </div>

      <div
        className="border-b bg-white px-6 py-4"
        style={{ borderColor: BORDER }}
      >
        <div
          className="mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ maxWidth: 900 }}
        >
          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: isActive ? PRIMARY : BORDER,
                    backgroundColor: isActive ? "#e8f0fb" : "#fff",
                    color: isActive ? PRIMARY : "#666",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            placeholder={t.historial.buscarPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/20 sm:max-w-[220px]"
            style={{ borderColor: BORDER }}
          />
        </div>
      </div>

      <main className="mx-auto px-4 py-5 sm:px-7" style={{ maxWidth: 900 }}>
        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {filteredBookings.length === 0 ? (
          <div
            className="rounded-xl border bg-white"
            style={{ borderColor: BORDER }}
          >
            {bookings.length === 0 ? (
              <EmptyState
                title={t.historial.sinReservas}
                description={t.historial.sinReservasDesc}
                actionLabel={t.historial.buscarServicios}
                actionHref="/buscar"
              />
            ) : (
              <EmptyState
                title={t.historial.sinFiltro}
                description={t.historial.sinFiltroDesc}
                actionLabel={t.historial.verTodas}
                onAction={() => setActiveFilter("todas")}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <p className="text-[11px] leading-relaxed text-[#888]">
              {t.historial.importesNota}
            </p>
            {groupedByMonth.map(([monthKey, monthBookings]) => (
              <section key={monthKey}>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: PRIMARY }}
                  >
                    {getBookingMonthLabel(monthKey)}
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: BORDER }} />
                </div>
                <ul className="flex flex-col gap-3">
                  {monthBookings.map((booking) => (
                    <li key={booking.id}>
                      <BookingCard
                        booking={booking}
                        reviewed={reviewedIds.has(booking.id)}
                        onCancel={handleCancel}
                        cancelling={cancellingId}
                        onIncidenciaReported={handleIncidenciaReported}
                        t={t}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
      <ActionToastHost toast={toast} onDismiss={dismiss} />
    </div>
  );
}
