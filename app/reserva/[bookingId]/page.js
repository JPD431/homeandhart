"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProveedorPreguntarButton from "@/app/components/ProveedorPreguntarButton";
import ReportarIncidenciaForm from "@/app/components/ReportarIncidenciaForm";
import ClienteVerificadoBadge from "@/app/components/ClienteVerificadoBadge";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  BOOKING_VERTICAL_META,
  canShowProviderContact,
  formatBookingPrice,
  getBookingDateRangeLabel,
  getBookingDurationLabel,
  getBookingEstado,
  getBookingStatusMeta,
  getCancelRefundBreakdown,
  getClientPriceBreakdown,
  getLugarServicioLabel,
} from "@/app/lib/booking-display";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";
import { buildLoginUrl } from "@/app/lib/auth-redirect";
import { canLeaveReview } from "@/app/lib/reviews";
import {
  loadServiceContact,
  mergeResolvedContactIntoService,
} from "@/app/lib/service-contact";
import { shouldShowProviderDireccion } from "@/app/lib/lugar-servicio";
import { MODALIDAD_COBRO_OPTIONS } from "@/app/lib/modalidad-cobro";
import { supabase } from "@/app/lib/supabase";
import BookingStatusBadge from "@/app/components/BookingStatusBadge";
import { friendlyLoadError, withLoadTimeout } from "@/app/lib/with-load-timeout";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

function modalidadLabelOf(modalidad) {
  if (!modalidad) return null;
  return (
    MODALIDAD_COBRO_OPTIONS.find((o) => o.value === modalidad)?.label ||
    String(modalidad).replace(/_/g, " ")
  );
}

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";
const GREEN = "#0e7a5c";

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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export default function ReservaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.bookingId;
  const { lang } = useLang();
  const t = useTranslation(lang);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewerRole, setViewerRole] = useState(null); // 'cliente' | 'proveedor'
  const [booking, setBooking] = useState(null);
  const [grupoSiblings, setGrupoSiblings] = useState([]);
  const [clienteContacto, setClienteContacto] = useState(null);
  const [clienteProfile, setClienteProfile] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [responding, setResponding] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let navigatedAway = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        await withLoadTimeout(
          (async () => {
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
              navigatedAway = true;
              router.replace(buildLoginUrl(`/reserva/${bookingId}`));
              return;
            }

            const { data: row, error: bookingError } = await supabase
              .from("bookings")
              .select(
                `
                *,
                services:service_id (
                  id,
                  titulo,
                  vertical,
                  precio,
                  ciudad,
                  proveedor_id,
                  modalidad,
                  profiles_public:proveedor_id (nombre, apellido)
                )
              `,
              )
              .eq("id", bookingId)
              .maybeSingle();

            if (bookingError) throw bookingError;
            if (!row) {
              setLoadError(t.reserva.noEncontrada);
              return;
            }

            const rawService = Array.isArray(row.services)
              ? row.services[0]
              : row.services;
            const proveedorId = rawService?.proveedor_id || null;

            let role = null;
            if (row.cliente_id === user.id) role = "cliente";
            else if (proveedorId && proveedorId === user.id) role = "proveedor";

            if (!role) {
              setLoadError(t.reserva.sinPermiso);
              return;
            }
            if (cancelled) return;
            setViewerRole(role);

            let mergedService = rawService ?? null;
            if (role === "cliente" && row.service_id) {
              const contact = await loadServiceContact(row.service_id);
              if (mergedService || contact) {
                mergedService = mergeResolvedContactIntoService(
                  mergedService || { id: row.service_id },
                  contact,
                );
              }
            }

            if (cancelled) return;
            setBooking({ ...row, services: mergedService });

            if (row.grupo_reserva) {
              const { data: siblings } = await supabase
                .from("bookings")
                .select(
                  "id, precio_total, precio_base, credito_aplicado, estado, services:service_id(titulo, vertical)",
                )
                .eq("grupo_reserva", row.grupo_reserva)
                .neq("id", row.id)
                .order("created_at", { ascending: true });
              if (!cancelled) setGrupoSiblings(siblings ?? []);
            } else {
              setGrupoSiblings([]);
            }

            if (role === "cliente") {
              const { data: review } = await supabase
                .from("reviews")
                .select("id")
                .eq("booking_id", bookingId)
                .maybeSingle();
              if (!cancelled) setReviewed(!!review);
            }

            if (role === "proveedor" && canShowProviderContact(row.estado)) {
              const res = await fetch(
                `/api/bookings/cliente-contacto?ids=${row.id}`,
              );
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.contacts?.[row.id]) {
                if (!cancelled) setClienteContacto(data.contacts[row.id]);
              }
              const { data: cli } = await supabase
                .from("profiles_public")
                .select("nombre, apellido, dni_verificado")
                .eq("id", row.cliente_id)
                .maybeSingle();
              if (!cancelled) setClienteProfile(cli ?? null);
            }
          })(),
        );
      } catch (err) {
        if (!cancelled && !navigatedAway) {
          setLoadError(friendlyLoadError(err));
        }
      } finally {
        if (!cancelled && !navigatedAway) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, bookingId, reloadKey]);

  async function handleCancelCliente() {
    if (!booking || !window.confirm(t.reserva.confirmarCancelarCliente))
      return;

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
        reembolso_cliente_total:
          reembolso.bruto != null ? reembolso.bruto : null,
        reembolso_cliente_credito:
          reembolso.credito != null ? reembolso.credito : null,
      }));
      setSuccessMessage(t.reserva.canceladaOk);
    } else {
      setErrorMessage(data.error || t.reserva.canceladaError);
    }
    setCancelling(false);
  }

  async function handleCancelProveedor() {
    if (
      !booking ||
      !window.confirm(t.reserva.confirmarCancelarProveedor)
    ) {
      return;
    }
    setCancelling(true);
    setErrorMessage("");
    const res = await fetch("/api/bookings/cancel-proveedor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success !== false) && !data.error) {
      setBooking((prev) => ({
        ...prev,
        estado: data.estado || "cancelada_proveedor",
      }));
      setSuccessMessage(t.reserva.canceladaOk);
    } else {
      setErrorMessage(data.error || t.reserva.canceladaError);
    }
    setCancelling(false);
  }

  async function handleRespond(accion) {
    if (!booking) return;
    setResponding(true);
    setErrorMessage("");
    const res = await fetch("/api/bookings/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id, action: accion }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success || data.estado)) {
      setBooking((prev) => ({
        ...prev,
        estado: data.estado || (accion === "aceptar" ? "confirmada" : "rechazada"),
      }));
      setSuccessMessage(
        accion === "aceptar"
          ? t.reserva.reservaAceptada
          : t.reserva.reservaRechazada,
      );
    } else {
      setErrorMessage(
        data.error || t.reserva.respondError,
      );
    }
    setResponding(false);
  }

  async function handleCompletarServicio() {
    if (!booking) return;
    if (!window.confirm(t.reserva.confirmarCompletar)) {
      return;
    }
    setCompleting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/bookings/completar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error || t.reserva.completarError);
        return;
      }
      setBooking((prev) => ({
        ...prev,
        estado: "completada",
        completada_at: prev.completada_at || new Date().toISOString(),
        confirmacion_cliente: "ok",
      }));
      setSuccessMessage(t.reserva.completadaOk);
    } catch {
      setErrorMessage(t.reserva.completarConexionError);
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <main className="px-6 py-16 text-center text-sm text-[#666]">
          {t.reserva.cargando}
        </main>
      </div>
    );
  }

  if (loadError || !booking) {
    const backHref =
      viewerRole === "proveedor" ? "/dashboard?tab=proveedor" : "/historial";
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <nav
          className="flex items-center justify-between border-b bg-white px-6 py-3"
          style={{ borderColor: BORDER }}
        >
          <Link
            href="/"
            className="no-underline"
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 600,
              color: "#1a1a1a",
            }}
          >
            Home
            <span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
            Heart
          </Link>
          <Link
            href={backHref}
            className="text-sm no-underline"
            style={{ color: "#666" }}
          >
            {t.reserva.volver}
          </Link>
        </nav>
        <main className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-sm text-red-700">
            {loadError || t.reserva.noEncontrada}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 mr-3 text-sm font-semibold"
            style={{ color: PRIMARY }}
          >
            {t.reserva.reintentar}
          </button>
          <Link
            href={backHref}
            className="mt-4 inline-block text-sm font-semibold no-underline"
            style={{ color: PRIMARY }}
          >
            {t.reserva.volverLink}
          </Link>
        </main>
      </div>
    );
  }

  const estado = getBookingEstado(booking);
  const statusMeta = getBookingStatusMeta(booking.estado || estado, {
    role: viewerRole || "cliente",
  });
  const service = booking.services ?? {};
  const proveedor = service.profiles_public ?? {};
  const vertical = service.vertical ?? "alojamiento";
  const vMeta =
    BOOKING_VERTICAL_META[vertical] ?? BOOKING_VERTICAL_META.alojamiento;
  const proveedorNombre =
    [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") ||
    "Proveedor";
  const clienteNombre =
    [clienteProfile?.nombre, clienteProfile?.apellido]
      .filter(Boolean)
      .join(" ") || "Cliente";
  const duration = getBookingDurationLabel(booking, vertical);
  const refundBreakdown = getCancelRefundBreakdown(booking);
  const priceBreakdown = getClientPriceBreakdown(booking);
  const ingresoProveedor = getIngresoProveedorFromBooking(booking);
  const showContact = canShowProviderContact(estado);
  const telefono = service.telefono_contacto || null;
  const showProviderDireccion =
    viewerRole === "cliente" &&
    showContact &&
    shouldShowProviderDireccion({
      lugarServicio: booking.lugar_servicio,
      vertical,
      modalidad: service.modalidad,
    });
  const providerDireccion = showProviderDireccion
    ? service.direccion_exacta || null
    : null;
  const lugarLabel = getLugarServicioLabel(booking.lugar_servicio, {
    viewer: viewerRole,
  });
  const modalidadLabel = modalidadLabelOf(service.modalidad);
  const backHref =
    viewerRole === "proveedor" ? "/dashboard?tab=proveedor" : "/historial";
  const backLabel =
    viewerRole === "proveedor" ? t.reserva.volverMisReservas : t.reserva.volverHistorial;

  const reviewEligible =
    viewerRole === "cliente" &&
    estado === "completada" &&
    canLeaveReview(booking, { hasReview: reviewed }).ok;

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <nav
        className="flex items-center justify-between border-b bg-white px-6 py-3"
        style={{ borderColor: BORDER }}
      >
        <Link
          href="/"
          className="no-underline"
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 600,
            color: "#1a1a1a",
          }}
        >
          Home
          <span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
          Heart
        </Link>
        <Link
          href={backHref}
          className="text-sm no-underline"
          style={{ color: "#666" }}
        >
          {backLabel}
        </Link>
      </nav>

      <main className="mx-auto px-4 py-6 sm:px-6 sm:py-8" style={{ maxWidth: 640 }}>
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
            {successMessage && (
              <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                {successMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
                  {viewerRole === "proveedor"
                    ? t.reserva.reservaRecibida
                    : t.reserva.detalleReserva}
                </p>
                <h1
                  className="mt-1 text-xl text-[#1a1a1a]"
                  style={{ fontFamily: SERIF, fontWeight: 400 }}
                >
                  {service.titulo || "Servicio Home&Heart"}
                </h1>
                <p className="mt-1 text-sm text-[#666]">
                  {viewerRole === "proveedor" ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{clienteNombre}</span>
                      {clienteProfile?.dni_verificado && (
                        <ClienteVerificadoBadge compact />
                      )}
                      <span>· {vMeta.label}</span>
                    </span>
                  ) : (
                    <>
                      {proveedorNombre} · {vMeta.label}
                      {service.ciudad ? ` · ${service.ciudad}` : ""}
                    </>
                  )}
                </p>
              </div>
              <BookingStatusBadge
                status={booking.estado || estado}
                role={viewerRole || "cliente"}
              />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-[#666]">
              {statusMeta.description}
            </p>

            <Section title={t.reserva.fechasServicio}>
              <p className="text-sm text-[#1a1a1a]">
                {getBookingDateRangeLabel(booking)}
              </p>
              {duration && (
                <p className="mt-0.5 text-xs text-[#888]">{t.reserva.duracion} {duration}</p>
              )}
              {booking.hora && (
                <p className="mt-0.5 text-xs text-[#888]">
                  {t.reserva.horaInicio} {booking.hora}
                </p>
              )}
              {modalidadLabel && (
                <p className="mt-0.5 text-xs text-[#888]">
                  {t.reserva.modalidad} {modalidadLabel}
                </p>
              )}
              {lugarLabel && (
                <p className="mt-0.5 text-xs text-[#888]">{t.reserva.lugar} {lugarLabel}</p>
              )}
              {booking.num_huespedes != null && (
                <p className="mt-0.5 text-xs text-[#888]">
                  {booking.num_huespedes}{" "}
                  {booking.num_huespedes === 1
                    ? vertical === "ninos"
                      ? t.reserva.nino
                      : vertical === "mascotas"
                        ? t.reserva.mascota
                        : t.reserva.huesped
                    : vertical === "ninos"
                      ? t.reserva.ninos
                      : vertical === "mascotas"
                        ? t.reserva.mascotas
                        : t.reserva.huespedes}
                </p>
              )}
            </Section>

            <Section
              title={
                viewerRole === "proveedor" ? t.reserva.tuIngreso : t.reserva.precio
              }
            >
              {viewerRole === "cliente" ? (
                <div className="space-y-1.5 text-sm">
                  {priceBreakdown.lines.map((line) => (
                    <div
                      key={line.label}
                      className="flex justify-between gap-4"
                      style={{
                        color: line.amount < 0 ? GREEN : "#444",
                      }}
                    >
                      <span>{line.label}</span>
                      <span className="font-medium tabular-nums">
                        {line.amount < 0
                          ? `−${formatBookingPrice(Math.abs(line.amount))}`
                          : formatBookingPrice(line.amount)}
                      </span>
                    </div>
                  ))}
                  <div
                    className={`${priceBreakdown.lines.length > 0 ? "mt-2 border-t pt-2" : ""} flex justify-between gap-4 text-base font-semibold`}
                    style={{
                      borderColor: BORDER,
                      color: PRIMARY,
                    }}
                  >
                    <span>
                      {priceBreakdown.credito > 0
                        ? t.reserva.totalAPagar
                        : t.reserva.totalPagado}
                    </span>
                    <span className="tabular-nums">
                      {formatBookingPrice(priceBreakdown.total)}
                    </span>
                  </div>
                  {priceBreakdown.footnote ? (
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{
                        color:
                          priceBreakdown.footnote.kind === "sin_gestion"
                            ? GREEN
                            : "#888",
                      }}
                    >
                      {priceBreakdown.footnote.text}
                    </p>
                  ) : null}
                  {refundBreakdown && (
                    <div className="mt-3 space-y-1 rounded-lg bg-[#f7f5f2] px-3 py-2 text-xs">
                      <p style={{ color: GREEN }}>
                        {t.reserva.devolucion}{" "}
                        {formatBookingPrice(refundBreakdown.reembolsoTotal)} (
                        {refundBreakdown.reembolsoPct}%)
                      </p>
                      {refundBreakdown.reembolsoCredito > 0 && (
                        <p style={{ color: GREEN }}>
                          +
                          {formatBookingPrice(refundBreakdown.reembolsoCredito)}{" "}
                          {t.reserva.aTuCredito}
                        </p>
                      )}
                      <p className="font-semibold" style={{ color: PRIMARY }}>
                        {t.reserva.pagasFinalmente}{" "}
                        {formatBookingPrice(refundBreakdown.importeFinal)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4 text-[#444]">
                    <span>{t.reserva.baseServicio}</span>
                    <span className="font-medium tabular-nums">
                      {formatBookingPrice(priceBreakdown.base)}
                    </span>
                  </div>
                  <div
                    className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"
                    style={{ borderColor: BORDER, color: GREEN }}
                  >
                    <span>{t.reserva.recibes}</span>
                    <span className="tabular-nums">
                      {formatBookingPrice(ingresoProveedor)}
                    </span>
                  </div>
                  {booking.proveedor_sin_comision && (
                    <p className="text-[11px]" style={{ color: GREEN }}>
                      {t.reserva.sinComisionProveedor}
                    </p>
                  )}
                  {booking.pago_liberado_at && (
                    <p className="text-[11px] text-[#888]">
                      {t.reserva.pagoLiberado}{" "}
                      {new Date(booking.pago_liberado_at).toLocaleDateString(
                        lang === "en" ? "en-GB" : "es-ES",
                      )}
                    </p>
                  )}
                </div>
              )}
            </Section>

            {grupoSiblings.length > 0 && (
              <Section title={t.reserva.reservaAgrupada}>
                <p className="mb-2 text-xs text-[#888]">
                  {t.reserva.agrupadaDesc}
                </p>
                <ul className="space-y-2">
                  <li
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: PRIMARY, background: "#e8f0fb" }}
                  >
                    <span className="font-medium">
                      {service.titulo || t.reserva.esteServicio}
                    </span>
                    <span className="ml-2 text-[#666]">
                      {formatBookingPrice(booking.precio_total)} · {t.reserva.actual}
                    </span>
                  </li>
                  {grupoSiblings.map((sib) => {
                    const sibService = Array.isArray(sib.services)
                      ? sib.services[0]
                      : sib.services;
                    return (
                      <li key={sib.id}>
                        <Link
                          href={`/reserva/${sib.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm no-underline transition-colors hover:bg-[#f7f5f2]"
                          style={{ borderColor: BORDER, color: "#1a1a1a" }}
                        >
                          <span>
                            {sibService?.titulo || t.reserva.servicioFallback}
                            <span className="ml-2 text-[11px] text-[#888]">
                              {
                                getBookingStatusMeta(sib.estado, {
                                  role: viewerRole || "cliente",
                                }).label
                              }
                            </span>
                          </span>
                          <span className="font-medium" style={{ color: PRIMARY }}>
                            {formatBookingPrice(sib.precio_total)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {booking.mensaje?.trim() && (
              <Section
                title={
                  viewerRole === "proveedor"
                    ? t.reserva.mensajeCliente
                    : t.reserva.tuMensaje
                }
              >
                <p className="text-sm leading-relaxed text-[#444]">
                  {booking.mensaje.trim()}
                </p>
              </Section>
            )}

            {viewerRole === "cliente" && showContact && (
              <section
                className="mt-5 rounded-lg border p-4"
                style={{ borderColor: BORDER, backgroundColor: "#f7f5f2" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  {t.reserva.contactoProveedor}
                </p>
                {telefono && (
                  <p className="mt-2 text-sm">
                    {t.reserva.telefono}{" "}
                    <a
                      href={`tel:${telefono}`}
                      className="font-medium no-underline"
                      style={{ color: PRIMARY }}
                    >
                      {telefono}
                    </a>
                  </p>
                )}
                {providerDireccion && (
                  <p className="mt-1 text-sm text-[#444]">
                    {t.reserva.direccion} {providerDireccion}
                  </p>
                )}
                {booking.lugar_servicio === "casa_cliente" && (
                  <p className="mt-1 text-[11px] text-[#888]">
                    {t.reserva.servicioEnTuCasa}
                    {booking.direccion_cliente_a_definir
                      ? t.reserva.direccionACoordar
                      : ""}
                    .
                  </p>
                )}
                {service.proveedor_id && (
                  <ProveedorPreguntarButton
                    proveedorId={service.proveedor_id}
                    className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: PRIMARY,
                      color: PRIMARY,
                      backgroundColor: "#fff",
                    }}
                    onError={(msg) => setErrorMessage(msg)}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                  >
                    {t.reserva.enviarMensaje}
                  </ProveedorPreguntarButton>
                )}
              </section>
            )}

            {viewerRole === "proveedor" && showContact && (
              <section
                className="mt-5 rounded-lg border p-4"
                style={{ borderColor: "#bfdbfe", backgroundColor: "#e8f0fb" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4f91]">
                  {t.reserva.contactoCliente}
                </p>
                <p className="mt-2 text-sm font-medium text-[#1a1a1a]">
                  {clienteNombre}
                  {clienteProfile?.dni_verificado && (
                    <span className="ml-2 inline-flex align-middle">
                      <ClienteVerificadoBadge compact />
                    </span>
                  )}
                </p>
                {clienteContacto?.telefono && (
                  <p className="mt-1 text-sm">
                    {t.reserva.telefono}{" "}
                    <a
                      href={`tel:${clienteContacto.telefono}`}
                      className="font-medium no-underline"
                      style={{ color: PRIMARY }}
                    >
                      {clienteContacto.telefono}
                    </a>
                  </p>
                )}
                {(clienteContacto?.direccion_cliente ||
                  clienteContacto?.direccion_cliente_a_definir) && (
                  <p className="mt-1 text-sm text-[#444]">
                    {clienteContacto.direccion_cliente
                      ? `${t.reserva.direccion} ${clienteContacto.direccion_cliente}`
                      : `${t.reserva.direccion} ${t.reserva.coordinarTelefono}`}
                  </p>
                )}
                {booking.cliente_id && (
                  <ProveedorPreguntarButton
                    proveedorId={booking.cliente_id}
                    className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: PRIMARY,
                      color: PRIMARY,
                      backgroundColor: "#fff",
                    }}
                    onError={(msg) => setErrorMessage(msg)}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                  >
                    {t.reserva.enviarMensaje}
                  </ProveedorPreguntarButton>
                )}
              </section>
            )}

            {(estado === "incidencia" || estado === "incidencia_resuelta") && (
              <section
                className="mt-5 rounded-lg border px-4 py-3 text-sm"
                style={{
                  borderColor:
                    estado === "incidencia" ? "#fecaca" : "#e5e7eb",
                  backgroundColor:
                    estado === "incidencia" ? "#fef2f2" : "#f9fafb",
                  color: estado === "incidencia" ? "#b91c1c" : "#4b5563",
                }}
              >
                {statusMeta.description}
              </section>
            )}

            {statusMeta.canReportIncidencia && (
              <section className="mt-5">
                <ReportarIncidenciaForm
                  bookingId={booking.id}
                  onSuccess={() => {
                    setBooking((prev) => ({ ...prev, estado: "incidencia" }));
                    setSuccessMessage(
                      "Incidencia enviada correctamente. Nuestro equipo la revisará.",
                    );
                    setErrorMessage("");
                  }}
                />
              </section>
            )}

            <div
              className="mt-6 flex flex-wrap gap-2 border-t pt-5"
              style={{ borderColor: BORDER }}
            >
              {viewerRole === "cliente" &&
                (estado === "confirmada" || estado === "en_curso") && (
                  <ActionButton
                    onClick={handleCompletarServicio}
                    disabled={completing}
                    primary
                  >
                    {completing ? t.reserva.confirmando : t.reserva.servicioRealizado}
                  </ActionButton>
                )}

              {viewerRole === "cliente" &&
                (estado === "pendiente" || estado === "confirmada") && (
                  <ActionButton
                    onClick={handleCancelCliente}
                    disabled={cancelling}
                  >
                    {cancelling ? t.reserva.cancelando : t.reserva.cancelarReserva}
                  </ActionButton>
                )}

              {viewerRole === "proveedor" && estado === "pendiente" && (
                <>
                  <ActionButton
                    onClick={() => handleRespond("aceptar")}
                    disabled={responding}
                    primary
                  >
                    {responding ? t.reserva.procesando : t.reserva.aceptar}
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleRespond("rechazar")}
                    disabled={responding}
                  >
                    {t.reserva.rechazar}
                  </ActionButton>
                </>
              )}

              {viewerRole === "proveedor" && estado === "confirmada" && (
                <ActionButton
                  onClick={handleCancelProveedor}
                  disabled={cancelling}
                >
                  {cancelling ? t.reserva.cancelando : t.reserva.cancelarReserva}
                </ActionButton>
              )}

              {viewerRole === "cliente" && estado === "completada" && (
                <>
                  <ActionButton
                    href={`/api/facturas/${booking.id}`}
                    primary
                  >
                    {t.reserva.descargarFactura}
                  </ActionButton>
                  {reviewed ? (
                    <span
                      className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold"
                      style={{ backgroundColor: "#f0f4f8", color: GREEN }}
                    >
                      {t.reserva.resenada}
                    </span>
                  ) : reviewEligible ? (
                    <ActionButton href={`/resena/${booking.id}`} primary>
                      {t.reserva.dejarResena}
                    </ActionButton>
                  ) : null}
                </>
              )}

              {viewerRole === "cliente" &&
                (estado === "cancelada" ||
                  estado === "cancelada_proveedor" ||
                  estado === "rechazada") && (
                  <ActionButton href="/buscar" primary>
                    {t.reserva.buscarAlternativas}
                  </ActionButton>
                )}

              {booking.service_id && (
                <ActionButton href={`/anuncio/${booking.service_id}`}>
                  {t.reserva.verAnuncio}
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
