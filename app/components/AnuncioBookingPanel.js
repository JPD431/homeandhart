"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CalendarioDisponibilidad from "@/app/components/CalendarioDisponibilidad";
import { formatShortDate } from "@/app/components/calendario-shared";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import {
  buildReservarHref,
  formatServiceCardPrice,
  getServiceCardTheme,
  translatePriceSuffix,
} from "@/app/lib/service-card-display";
import {
  resolveDisplayPriceSuffix,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";
import {
  getPrecioConDescuento,
  isOfertaActiva,
} from "@/app/lib/ofertas";

/** Precio mostrado (con oferta aplicada si hay) y sufijo, ya en el idioma activo. */
function resolveBookingPrice(service, lang) {
  const theme = getServiceCardTheme(service?.vertical);
  const priceSuffix = translatePriceSuffix(
    supportsModalidadCobro(service?.vertical)
      ? resolveDisplayPriceSuffix(service)
      : theme.priceSuffix,
    lang,
  );
  const ofertaActiva = isOfertaActiva(service);
  const precioConDescuento = ofertaActiva
    ? getPrecioConDescuento(service.precio, service.oferta_descuento)
    : null;
  const displayPrice = ofertaActiva
    ? formatServiceCardPrice(precioConDescuento, priceSuffix, lang)
    : formatServiceCardPrice(service?.precio, priceSuffix, lang);

  return { priceSuffix, ofertaActiva, displayPrice };
}

/**
 * Panel sticky de reserva en /anuncio/[serviceId].
 * Fechas ?desde/?hasta se leen en el cliente (ISR público no toca searchParams).
 */
function AnuncioBookingPanelInner({
  service,
  serviceCalendario,
  bloqueos,
  accentColor = "#1d4f91",
  isOwnerPreview = false,
}) {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const searchParams = useSearchParams();
  const initialDesde = searchParams.get("desde") || "";
  const initialHasta = searchParams.get("hasta") || "";

  const { priceSuffix, ofertaActiva, displayPrice } = resolveBookingPrice(
    service,
    lang,
  );

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
    if (!fechaDesde) return t.anuncio.reservar;
    const fin = fechaHasta || fechaDesde;
    if (fechaDesde === fin) {
      return `${t.anuncio.reservar} · ${formatShortDate(fechaDesde, lang)}`;
    }
    return `${t.anuncio.reservar} · ${formatShortDate(fechaDesde, lang)} – ${formatShortDate(fin, lang)}`;
  }, [fechaDesde, fechaHasta, lang, t]);

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
              {formatServiceCardPrice(service.precio, priceSuffix, lang)}
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
        <p
          className="mt-5 rounded-lg border px-3 py-2.5 text-center text-[11px] text-[#888]"
          style={{ borderColor: "#e8e4de", backgroundColor: "#fafaf9" }}
        >
          {t.anuncio.reservaDisponiblePublicar}
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
              {t.anuncio.tambienFechas}
            </p>
          )}
        </>
      )}
    </aside>
  );
}

/** Fallback SSR/Suspense: mismo panel sin query de fechas (hasta hidratar). */
function AnuncioBookingPanelFallback({
  service,
  serviceCalendario,
  bloqueos,
  accentColor = "#1d4f91",
  isOwnerPreview = false,
}) {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const { displayPrice } = resolveBookingPrice(service, lang);

  return (
    <aside
      className="rounded-xl border bg-white p-5 shadow-sm md:sticky md:top-6"
      style={{ borderColor: "#e8e4de" }}
    >
      <div className="border-b pb-4" style={{ borderColor: "#f0ede8" }}>
        <p
          className="text-[22px] font-semibold leading-none"
          style={{ color: accentColor }}
        >
          {displayPrice}
        </p>
      </div>
      <div className="mt-4">
        <CalendarioDisponibilidad
          services={[serviceCalendario]}
          bloqueos={bloqueos}
          initialDesde=""
          initialHasta=""
          embedded
          singleMonth
          showReservaLink={false}
        />
      </div>
      {isOwnerPreview ? (
        <p
          className="mt-5 rounded-lg border px-3 py-2.5 text-center text-[11px] text-[#888]"
          style={{ borderColor: "#e8e4de", backgroundColor: "#fafaf9" }}
        >
          {t.anuncio.reservaDisponiblePublicar}
        </p>
      ) : (
        <Link
          href={buildReservarHref(service.id)}
          className="mt-5 block w-full rounded-lg py-3 text-center text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          {t.anuncio.reservar}
        </Link>
      )}
    </aside>
  );
}

export default function AnuncioBookingPanel(props) {
  return (
    <Suspense fallback={<AnuncioBookingPanelFallback {...props} />}>
      <AnuncioBookingPanelInner {...props} />
    </Suspense>
  );
}
