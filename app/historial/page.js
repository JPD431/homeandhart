"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  BOOKING_STATUS_STYLES,
  BOOKING_VERTICAL_META,
  formatBookingPrice,
  getBookingDateRangeLabel,
  getBookingDurationLabel,
  getBookingEstado,
  getBookingMonthKey,
  getBookingMonthLabel,
  getCancelRefundBreakdown,
} from "@/app/lib/booking-display";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";
const BORDER = "#e8e4de";

const FILTER_TABS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "confirmada", label: "Confirmadas" },
  { id: "en_curso", label: "En curso" },
  { id: "completada", label: "Completadas" },
  { id: "cancelada", label: "Canceladas" },
];

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

function StatusTag({ status }) {
  const key = status ?? "pendiente";
  const style = BOOKING_STATUS_STYLES[key] ?? BOOKING_STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
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

function BookingCard({ booking, reviewed, onCancel, cancelling }) {
  const estado = getBookingEstado(booking);
  const service = booking.services ?? {};
  const proveedor = service.profiles_public ?? {};
  const vertical = service.vertical ?? "alojamiento";
  const vMeta = BOOKING_VERTICAL_META[vertical] ?? BOOKING_VERTICAL_META.alojamiento;
  const proveedorNombre =
    [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") || "Proveedor";
  const zona = service.ciudad || "—";
  const duration = getBookingDurationLabel(booking, vertical);
  const personas = vertical === "alojamiento" ? "2 pers." : null;
  const metaParts = [getBookingDateRangeLabel(booking), duration, personas].filter(Boolean);
  const extraTags = getExtraTags(service, vertical);
  const refundBreakdown = getCancelRefundBreakdown(booking);

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
                  Pagas: {formatBookingPrice(refundBreakdown.importeFinal)}
                </p>
                <p className="mt-0.5 text-[10px] font-medium" style={{ color: GREEN }}>
                  Devolución: {formatBookingPrice(refundBreakdown.reembolsoTotal)} (
                  {refundBreakdown.reembolsoPct}%)
                </p>
                {refundBreakdown.reembolsoCredito > 0 && (
                  <p className="mt-0.5 text-[10px] font-medium" style={{ color: GREEN }}>
                    +{formatBookingPrice(refundBreakdown.reembolsoCredito)} a tu crédito
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
          <StatusTag status={estado} />
          {extraTags.map((tag) => (
            <ExtraTag key={tag} label={tag} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {estado === "completada" && (
            <>
              <a
                href={`/api/facturas/${booking.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white no-underline"
                style={{ backgroundColor: "#0e7a5c" }}
              >
                Descargar factura
              </a>
              {!reviewed && (
                <Link
                  href={`/resena/${booking.id}`}
                  className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white no-underline"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Dejar reseña
                </Link>
              )}
            </>
          )}

          {(estado === "confirmada" || estado === "pendiente") && (
            <>
              <GrayButton href={`/reserva/${booking.id}`}>Ver detalle</GrayButton>
              <GrayButton
                onClick={() => onCancel(booking)}
                disabled={cancelling === booking.id}
              >
                {cancelling === booking.id ? "Cancelando…" : "Cancelar"}
              </GrayButton>
            </>
          )}

          {estado === "en_curso" && (
            <GrayButton href={`/reserva/${booking.id}`}>Ver detalle</GrayButton>
          )}

          {estado === "cancelada" && (
            <GrayButton href={`/reserva/${booking.id}`}>Ver detalle</GrayButton>
          )}
        </div>
      </div>
    </article>
  );
}

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

export default function HistorialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [activeFilter, setActiveFilter] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [creditoDisponible, setCreditoDisponible] = useState(0);

  useEffect(() => {
    async function loadHistorial() {
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
        .select("credito_disponible")
        .eq("id", user.id)
        .maybeSingle();

      setCreditoDisponible(Number(profile?.credito_disponible) || 0);

      const { data: bookingsData } = await supabase
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

      const rows = bookingsData ?? [];
      setBookings(rows);

      if (rows.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("booking_id")
          .in("booking_id", rows.map((b) => b.id));

        setReviewedIds(new Set((reviews ?? []).map((r) => r.booking_id)));
      }

      setLoading(false);
    }

    loadHistorial();
  }, [router]);

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
      result = result.filter((b) => getBookingEstado(b) === activeFilter);
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
    if (!window.confirm("¿Seguro que quieres cancelar esta reserva?")) return;

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
    } else {
      setErrorMessage(data.error || "No se pudo cancelar la reserva.");
    }

    setCancellingId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <MiniNavbar />
        <main className="px-7 py-16 text-center text-sm text-[#666]">
          Cargando historial…
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

      <header className="border-b bg-white px-6 py-6" style={{ borderColor: BORDER }}>
        <div className="mx-auto" style={{ maxWidth: 900 }}>
          <h1
            className="text-[22px] text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            Historial de reservas
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Todas tus reservas pasadas y activas en un solo lugar
          </p>
        </div>
      </header>

      <div className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div
          className="mx-auto flex flex-wrap items-center justify-center"
          style={{ maxWidth: 900 }}
        >
          <StatItem label="Total reservas" value={stats.total} showDivider={false} />
          <StatItem label="Completadas" value={stats.completadas} showDivider />
          <StatItem label="Activas" value={stats.activas} showDivider />
          <StatItem
            label="Total gastado"
            value={formatBookingPrice(stats.totalGastado)}
            showDivider
          />
          {creditoDisponible > 0 && (
            <StatItem
              label="Crédito disponible"
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
            {FILTER_TABS.map((tab) => {
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
            placeholder="Buscar servicio o proveedor…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/20 sm:max-w-[220px]"
            style={{ borderColor: BORDER }}
          />
        </div>
      </div>

      <main className="mx-auto" style={{ padding: "20px 28px", maxWidth: 900 }}>
        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {filteredBookings.length === 0 ? (
          <p
            className="rounded-xl border bg-white px-6 py-12 text-center text-sm text-[#666]"
            style={{ borderColor: BORDER }}
          >
            No hay reservas en esta categoría.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
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
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
