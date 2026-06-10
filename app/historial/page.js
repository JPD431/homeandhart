"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import { procesarCancelacionTardia } from "@/app/lib/garantia";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

const VERTICAL_META = {
  alojamiento: { label: "Alojamiento", color: PRIMARY, gradient: `linear-gradient(135deg, ${PRIMARY}, #2a6bb5)` },
  ninos: { label: "Niñera", color: "#0e7a5c", gradient: "linear-gradient(135deg, #0e7a5c, #1a9d75)" },
  mascotas: { label: "Mascotas", color: "#c47d1a", gradient: "linear-gradient(135deg, #c47d1a, #e09a2e)" },
};

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#c47d1a", label: "Pendiente" },
  confirmada: { bg: "#e8f0fb", color: PRIMARY, label: "Confirmada" },
  en_curso: { bg: "#ede9fe", color: "#7c3aed", label: "En curso" },
  completada: { bg: "#e6f4f0", color: "#0e7a5c", label: "Completada" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencia" },
  cancelada: { bg: "#fee2e2", color: "#dc2626", label: "Cancelada" },
  cancelada_garantia: { bg: "#fee2e2", color: "#dc2626", label: "Cancelada" },
};

const FILTER_TABS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "confirmada", label: "Confirmadas" },
  { id: "en_curso", label: "En curso" },
  { id: "completada", label: "Completadas" },
  { id: "cancelada", label: "Canceladas" },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getBookingEstado(booking) {
  const estado = booking.estado ?? booking.status;
  if (estado === "cancelada_garantia") return "cancelada";
  return estado;
}

function formatPrice(precio) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio).toFixed(2)}€`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTH_NAMES[m - 1]?.slice(0, 3) ?? ""}`;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

function getDurationLabel(booking, vertical) {
  if (vertical === "ninos" && booking.duracion_horas) {
    return `${booking.duracion_horas}h`;
  }
  if (vertical === "alojamiento" || vertical === "mascotas") {
    const days = daysBetween(booking.fecha_inicio, booking.fecha_fin || booking.fecha_inicio);
    if (days) return `${days} ${days === 1 ? "noche" : vertical === "mascotas" ? "días" : "noches"}`;
  }
  return null;
}

function getDateRangeLabel(booking) {
  if (!booking.fecha_inicio) return "—";
  const start = formatDateShort(booking.fecha_inicio);
  const end = booking.fecha_fin && booking.fecha_fin !== booking.fecha_inicio
    ? formatDateShort(booking.fecha_fin)
    : null;
  if (booking.hora) return `${start} · ${booking.hora}`;
  return end ? `${start} – ${end}` : start;
}

function getMonthKey(booking) {
  const dateStr = booking.fecha_inicio || booking.created_at?.slice(0, 10);
  if (!dateStr) return "sin-fecha";
  const [y, m] = dateStr.split("-");
  return `${y}-${m}`;
}

function getMonthLabel(key) {
  if (key === "sin-fecha") return "SIN FECHA";
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]?.toUpperCase() ?? ""} ${y}`;
}

function getExtraTags(service, vertical) {
  const tags = [];
  const proveedor = service.profiles ?? {};
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
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
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
  const proveedor = service.profiles ?? {};
  const vertical = service.vertical ?? "alojamiento";
  const vMeta = VERTICAL_META[vertical] ?? VERTICAL_META.alojamiento;
  const proveedorNombre =
    [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") || "Proveedor";
  const zona = service.ciudad || "—";
  const duration = getDurationLabel(booking, vertical);
  const personas = vertical === "alojamiento" ? "2 pers." : null;
  const metaParts = [getDateRangeLabel(booking), duration, personas].filter(Boolean);
  const extraTags = getExtraTags(service, vertical);

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
          <p className="shrink-0 text-[13px] font-medium" style={{ color: PRIMARY }}>
            {formatPrice(booking.precio_total)}
          </p>
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
              <GrayButton href={`/reservar/${booking.service_id}`}>Ver detalle</GrayButton>
              <GrayButton
                onClick={() => onCancel(booking)}
                disabled={cancelling === booking.id}
              >
                {cancelling === booking.id ? "Cancelando…" : "Cancelar"}
              </GrayButton>
            </>
          )}

          {estado === "en_curso" && (
            <GrayButton href={`/reservar/${booking.service_id}`}>Ver detalle</GrayButton>
          )}

          {estado === "cancelada" && (
            <GrayButton href={`/reservar/${booking.service_id}`}>Ver detalle</GrayButton>
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
  const [userEmail, setUserEmail] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

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

      setUserEmail(user.email || "");

      const { data: perfil } = await supabase
        .from("profiles")
        .select("nombre, apellido")
        .eq("id", user.id)
        .single();

      setClienteNombre(
        [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Cliente",
      );

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
            profiles:proveedor_id (nombre, apellido, idiomas)
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
        const proveedor = service.profiles ?? {};
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
      const key = getMonthKey(booking);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(booking);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredBookings]);

  async function handleCancel(booking) {
    if (!window.confirm("¿Seguro que quieres cancelar esta reserva?")) return;

    setCancellingId(booking.id);
    setErrorMessage("");

    const result = await procesarCancelacionTardia({
      bookingId: booking.id,
      supabaseClient: supabase,
      userEmail,
      clienteNombre,
    });

    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                estado: result.garantia ? "cancelada_garantia" : "cancelada",
              }
            : b,
        ),
      );
    } else {
      setErrorMessage(result.error || "No se pudo cancelar la reserva.");
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
            value={formatPrice(stats.totalGastado)}
            showDivider
          />
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
                    {getMonthLabel(monthKey)}
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
