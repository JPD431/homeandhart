"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProveedorPreguntarButton from "@/app/components/ProveedorPreguntarButton";
import ReportarIncidenciaForm from "@/app/components/ReportarIncidenciaForm";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  BOOKING_STATUS_STYLES,
  BOOKING_VERTICAL_META,
  canShowProviderContact,
  formatBookingPrice,
  getBookingDateRangeLabel,
  getBookingDurationLabel,
  getBookingEstado,
  getCancelRefundBreakdown,
} from "@/app/lib/booking-display";
import { puedeReportarIncidencia } from "@/app/lib/booking-incidencia";
import { canLeaveReview } from "@/app/lib/reviews";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

function StatusBadge({ status }) {
  const key = status ?? "pendiente";
  const style = BOOKING_STATUS_STYLES[key] ?? BOOKING_STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function ActionButton({ children, href, onClick, disabled, primary = false }) {
  const className =
    "rounded-lg px-4 py-2 text-sm font-semibold no-underline transition-opacity disabled:opacity-60";
  const style = primary
    ? { backgroundColor: PRIMARY, color: "#fff" }
    : { border: `1px solid ${BORDER}`, backgroundColor: "#fff", color: "#444" };

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

export default function ReservaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.bookingId;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

      const { data: row, error: bookingError } = await supabase
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
            telefono_contacto,
            direccion_exacta,
            modalidad,
            profiles_public:proveedor_id (nombre, apellido)
          )
        `,
        )
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError || !row) {
        setErrorMessage("No se encontró la reserva.");
        setLoading(false);
        return;
      }

      if (row.cliente_id !== user.id) {
        setErrorMessage("No tienes permiso para ver esta reserva.");
        setLoading(false);
        return;
      }

      setBooking(row);

      const { data: review } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();

      setReviewed(!!review);
      setLoading(false);
    }

    load();
  }, [router, bookingId]);

  async function handleCancel() {
    if (!booking || !window.confirm("¿Seguro que quieres cancelar esta reserva?")) return;

    setCancelling(true);
    setErrorMessage("");

    const res = await fetch("/api/bookings/cancelar-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: booking.id }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      const reembolso = data.reembolso ?? {};
      setBooking((prev) => ({
        ...prev,
        estado: data.estado,
        reembolso_cliente_pct: reembolso.pct ?? null,
        reembolso_cliente_total: reembolso.bruto != null ? reembolso.bruto : null,
        reembolso_cliente_credito: reembolso.credito != null ? reembolso.credito : null,
      }));
    } else {
      setErrorMessage(data.error || "No se pudo cancelar la reserva.");
    }

    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <main className="px-6 py-16 text-center text-sm text-[#666]">Cargando reserva…</main>
      </div>
    );
  }

  if (errorMessage && !booking) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
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
          <Link href="/historial" className="text-sm no-underline" style={{ color: "#666" }}>
            ← Historial
          </Link>
        </nav>
        <main className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <Link href="/historial" className="mt-4 inline-block text-sm font-semibold no-underline" style={{ color: PRIMARY }}>
            Volver al historial
          </Link>
        </main>
      </div>
    );
  }

  const estado = getBookingEstado(booking);
  const service = booking.services ?? {};
  const proveedor = service.profiles_public ?? {};
  const vertical = service.vertical ?? "alojamiento";
  const vMeta = BOOKING_VERTICAL_META[vertical] ?? BOOKING_VERTICAL_META.alojamiento;
  const proveedorNombre =
    [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") || "Proveedor";
  const duration = getBookingDurationLabel(booking, vertical);
  const refundBreakdown = getCancelRefundBreakdown(booking);
  const creditoAplicado = Number(booking.credito_aplicado) || 0;
  const showContact = canShowProviderContact(estado);
  const telefono = service.telefono_contacto || null;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
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
        <Link href="/historial" className="text-sm no-underline" style={{ color: "#666" }}>
          ← Historial
        </Link>
      </nav>

      <main className="mx-auto px-6 py-8" style={{ maxWidth: 640 }}>
        <div
          className="overflow-hidden rounded-xl border bg-white"
          style={{ borderColor: BORDER }}
        >
          <div
            className="h-2"
            style={{ background: vMeta.gradient }}
            aria-hidden
          />

          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1
                  className="text-xl text-[#1a1a1a]"
                  style={{ fontFamily: SERIF, fontWeight: 400 }}
                >
                  {service.titulo || "Servicio Home&Heart"}
                </h1>
                <p className="mt-1 text-sm text-[#666]">
                  {proveedorNombre} · {vMeta.label}
                  {service.ciudad ? ` · ${service.ciudad}` : ""}
                </p>
              </div>
              <StatusBadge status={estado} />
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <section className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                Fechas
              </p>
              <p className="mt-1 text-sm text-[#1a1a1a]">{getBookingDateRangeLabel(booking)}</p>
              {duration && (
                <p className="mt-0.5 text-xs text-[#888]">Duración: {duration}</p>
              )}
            </section>

            <section className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                Precio
              </p>
              {refundBreakdown ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    Total reserva:{" "}
                    <span className="font-medium">{formatBookingPrice(booking.precio_total)}</span>
                  </p>
                  <p style={{ color: "#0e7a5c" }}>
                    Devolución: {formatBookingPrice(refundBreakdown.reembolsoTotal)} (
                    {refundBreakdown.reembolsoPct}%)
                  </p>
                  {refundBreakdown.reembolsoCredito > 0 && (
                    <p style={{ color: "#0e7a5c" }}>
                      +{formatBookingPrice(refundBreakdown.reembolsoCredito)} a tu crédito
                    </p>
                  )}
                  <p className="font-semibold" style={{ color: PRIMARY }}>
                    Pagas: {formatBookingPrice(refundBreakdown.importeFinal)}
                  </p>
                </div>
              ) : (
                <div className="mt-1 text-sm">
                  <p className="text-lg font-semibold" style={{ color: PRIMARY }}>
                    {formatBookingPrice(booking.precio_total)}
                  </p>
                  {creditoAplicado > 0 && (
                    <p className="mt-0.5 text-xs text-[#888]">
                      Incluye {formatBookingPrice(creditoAplicado)} de crédito aplicado
                    </p>
                  )}
                </div>
              )}
            </section>

            {booking.mensaje?.trim() && (
              <section className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Tu mensaje
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#444]">{booking.mensaje.trim()}</p>
              </section>
            )}

            {showContact && (
              <section
                className="mt-5 rounded-lg border p-4"
                style={{ borderColor: BORDER, backgroundColor: "#f7f5f2" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Contacto del proveedor
                </p>
                {telefono && (
                  <p className="mt-2 text-sm">
                    Teléfono:{" "}
                    <a href={`tel:${telefono}`} className="font-medium no-underline" style={{ color: PRIMARY }}>
                      {telefono}
                    </a>
                  </p>
                )}
                {service.direccion_exacta && (
                  <p className="mt-1 text-sm text-[#444]">{service.direccion_exacta}</p>
                )}
                {service.proveedor_id && (
                  <ProveedorPreguntarButton
                    proveedorId={service.proveedor_id}
                    className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: PRIMARY, color: PRIMARY, backgroundColor: "#fff" }}
                  >
                    Enviar mensaje
                  </ProveedorPreguntarButton>
                )}
              </section>
            )}

            {estado === "incidencia" && (
              <section
                className="mt-5 rounded-lg border px-4 py-3 text-sm"
                style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" }}
              >
                Hay un reporte de incidencia en curso. Nuestro equipo lo está revisando y te
                contactará pronto.
              </section>
            )}

            {puedeReportarIncidencia(estado) && (
              <section className="mt-5">
                <ReportarIncidenciaForm
                  bookingId={booking.id}
                  onSuccess={() => setBooking((prev) => ({ ...prev, estado: "incidencia" }))}
                />
              </section>
            )}

            <div className="mt-6 flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: BORDER }}>
              {(estado === "pendiente" || estado === "confirmada") && (
                <ActionButton onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Cancelando…" : "Cancelar reserva"}
                </ActionButton>
              )}

              {estado === "completada" && (
                <>
                  <ActionButton href={`/api/facturas/${booking.id}`} primary>
                    Descargar factura
                  </ActionButton>
                  {reviewed ? (
                    <span
                      className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold"
                      style={{ backgroundColor: "#f0f4f8", color: "#0e7a5c" }}
                    >
                      Reseñada ✓
                    </span>
                  ) : canLeaveReview(booking, { hasReview: false }).ok ? (
                    <ActionButton href={`/resena/${booking.id}`} primary>
                      Deja tu reseña
                    </ActionButton>
                  ) : null}
                </>
              )}

              {(estado === "cancelada" || estado === "rechazada") && (
                <ActionButton href="/buscar" primary>
                  Buscar alternativas
                </ActionButton>
              )}

              {booking.service_id && (
                <ActionButton href={`/anuncio/${booking.service_id}`}>
                  Ver anuncio
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
