"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import CalendarioDisponibilidad from "@/app/components/CalendarioDisponibilidad";
import { formatShortDate } from "@/app/components/calendario-shared";
import {
  buildReservarHref,
  formatServiceCardPrice,
  getServiceCardTheme,
} from "@/app/lib/service-card-display";
import {
  getPrecioConDescuento,
  isOfertaActiva,
} from "@/app/lib/ofertas";

/**
 * Panel sticky de reserva en /anuncio/[serviceId].
 *
 * @param {object} props
 * @param {object} props.service — fila services (precio, oferta, vertical, id)
 * @param {object} props.serviceCalendario — entrada para CalendarioDisponibilidad
 * @param {object[]} props.bloqueos
 * @param {string} [props.accentColor]
 * @param {string} [props.initialDesde]
 * @param {string} [props.initialHasta]
 * @param {boolean} [props.isOwnerPreview]
 */
export default function AnuncioBookingPanel({
  service,
  serviceCalendario,
  bloqueos,
  accentColor = "#1d4f91",
  initialDesde = "",
  initialHasta = "",
  isOwnerPreview = false,
}) {
  const theme = getServiceCardTheme(service?.vertical);
  const ofertaActiva = isOfertaActiva(service);
  const precioConDescuento = ofertaActiva
    ? getPrecioConDescuento(service.precio, service.oferta_descuento)
    : null;

  const displayPrice = ofertaActiva
    ? formatServiceCardPrice(precioConDescuento, theme.priceSuffix)
    : formatServiceCardPrice(service?.precio, theme.priceSuffix);

  const [fechaDesde, setFechaDesde] = useState(initialDesde);
  const [fechaHasta, setFechaHasta] = useState(initialHasta);

  const handleDatesChange = useCallback(({ desde, hasta }) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, []);

  const reservaHref = useMemo(
    () => buildReservarHref(service.id, fechaDesde, fechaHasta),
    [service.id, fechaDesde, fechaHasta],
  );

  const reservaLabel = useMemo(() => {
    if (!fechaDesde) return "Reservar";
    const fin = fechaHasta || fechaDesde;
    if (fechaDesde === fin) {
      return `Reservar · ${formatShortDate(fechaDesde)}`;
    }
    return `Reservar · ${formatShortDate(fechaDesde)} – ${formatShortDate(fin)}`;
  }, [fechaDesde, fechaHasta]);

  return (
    <aside
      className="rounded-xl border bg-white p-5 shadow-sm md:sticky md:top-6"
      style={{ borderColor: "#e8e4de" }}
    >
      <div className="border-b pb-4" style={{ borderColor: "#f0ede8" }}>
        {ofertaActiva && service.precio != null && service.precio !== "" ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <p
              className="text-[22px] font-semibold leading-none"
              style={{ color: accentColor }}
            >
              {displayPrice}
            </p>
            <p className="text-[13px] text-[#aaa] line-through">
              {formatServiceCardPrice(service.precio, theme.priceSuffix)}
            </p>
            {service.oferta_descuento ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: "#fdf3e3", color: "#92400e" }}
              >
                −{service.oferta_descuento}%
              </span>
            ) : null}
          </div>
        ) : (
          <p
            className="text-[22px] font-semibold leading-none"
            style={{ color: accentColor }}
          >
            {displayPrice}
          </p>
        )}
      </div>

      <div className="mt-4">
        <CalendarioDisponibilidad
          services={[serviceCalendario]}
          bloqueos={bloqueos}
          initialDesde={initialDesde}
          initialHasta={initialHasta}
          embedded
          singleMonth
          showReservaLink={false}
          onDatesChange={handleDatesChange}
        />
      </div>

      {isOwnerPreview ? (
        <p className="mt-5 rounded-lg border px-3 py-2.5 text-center text-[11px] text-[#888]" style={{ borderColor: "#e8e4de", backgroundColor: "#fafaf9" }}>
          La reserva estará disponible cuando publiques el anuncio.
        </p>
      ) : (
        <>
          <Link
            href={reservaHref}
            className="mt-5 block w-full rounded-lg py-3 text-center text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            {reservaLabel}
          </Link>

          {!fechaDesde && (
            <p className="mt-2 text-center text-[10px] text-[#aaa]">
              También puedes elegir fechas en la página de reserva
            </p>
          )}
        </>
      )}
    </aside>
  );
}
