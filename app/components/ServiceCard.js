"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ServiceCardPhotoCarousel from "@/app/components/ServiceCardPhotoCarousel";
import { supabase } from "@/app/lib/supabase";
import {
  buildAnuncioHref,
  buildReservarHref,
  formatServiceCardShortName,
  getServiceCardInitials,
  getServiceCardTags,
  getServiceCardTheme,
  getServiceCardZone,
  getServicePhotos,
  normalizeServiceProfile,
  resolveServiceCardPricing,
} from "@/app/lib/service-card-display";

/** Máximo 2 chips visibles, priorizando verificado y tipo de reserva. */
function pickCardTags(tags, profile, isPreview) {
  const verificado = tags.find((t) => t.text.includes("Verificado"));
  const reserva = tags.find(
    (t) => t.text.includes("Reserva inmediata") || t.text.includes("confirmación"),
  );
  const rest = tags.filter((t) => t !== verificado && t !== reserva);

  const badge =
    !isPreview && profile?.badge_respuesta === "rapido"
      ? { text: "⚡ Rápido", light: "#e6f4f0", color: "#085041" }
      : !isPreview && profile?.badge_respuesta === "pocas_horas"
        ? { text: "🕐 Pocas h", light: "#fdf3e3", color: "#92400e" }
        : null;

  const ordered = [verificado, reserva, ...rest, badge].filter(Boolean);
  return ordered.slice(0, 2);
}

/**
 * Tarjeta de servicio en búsqueda (y vista previa del wizard).
 */
export default function ServiceCard({
  service,
  isPreview = false,
  index = 0,
  isActive = false,
  onHover,
  onLeave,
  onSelect,
  extra,
  t,
  lang = "es",
  bundleMode = false,
  onBundleAdd,
  ratingsByProveedor = {},
  comparando = [],
  onToggleComparar,
  favoritos = [],
  fechaBusquedaDesde = "",
  fechaBusquedaHasta = "",
}) {
  const router = useRouter();
  const profile = service ? normalizeServiceProfile(service) : {};
  const theme = getServiceCardTheme(service?.vertical);
  const zone = service ? getServiceCardZone(service, profile) : "";
  const allTags = service
    ? getServiceCardTags(service, profile, lang, { isPreview })
    : [];
  const visibleTags = useMemo(
    () => pickCardTags(allTags, profile, isPreview),
    [allTags, profile, isPreview],
  );
  const pricing = resolveServiceCardPricing(service, lang);
  const priceLabel = pricing.priceLabel;
  const reservarLabel = pricing.reservarLabel;

  const rating = service
    ? ratingsByProveedor?.[service.proveedor_id]
    : undefined;
  const valoracionMedia =
    rating?.count > 0 ? (rating.sum / rating.count).toFixed(1) : null;
  const numReviews = rating?.count || 0;
  const isComparing = service
    ? comparando.some((s) => s.id === service.id)
    : false;
  const compareFull = comparando.length >= 3 && !isComparing;
  const [esFavorito, setEsFavorito] = useState(
    service && favoritos?.includes(service.proveedor_id),
  );

  useEffect(() => {
    if (isPreview || !service) return;
    setEsFavorito(favoritos?.includes(service.proveedor_id) || false);
  }, [favoritos, service, isPreview]);

  if (!service) return null;

  const photos = getServicePhotos(service);
  const anuncioHref = buildAnuncioHref(
    service.id,
    fechaBusquedaDesde,
    fechaBusquedaHasta,
  );
  const showAnuncioLinks = !isPreview && !bundleMode;

  const toggleFavorito = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    if (esFavorito) {
      await supabase
        .from("favoritos")
        .delete()
        .eq("cliente_id", user.id)
        .eq("proveedor_id", service.proveedor_id);
    } else {
      await supabase.from("favoritos").insert({
        cliente_id: user.id,
        proveedor_id: service.proveedor_id,
      });
    }
    setEsFavorito(!esFavorito);
  };

  const emptyRatingLabel = isPreview
    ? "Aún sin reseñas"
    : lang === "en"
      ? "No reviews"
      : "Sin valoraciones";

  const photoHref = isPreview
    ? null
    : showAnuncioLinks
      ? anuncioHref
      : `/proveedor/${profile.id}`;

  const handleCardClick = (e) => {
    onSelect?.(index);
    if (
      showAnuncioLinks &&
      !e.target.closest("button, a[href], [data-no-navigate]")
    ) {
      router.push(anuncioHref);
    }
  };

  const cardBody = (
    <>
      <ServiceCardPhotoCarousel
        photos={photos}
        vertical={service.vertical}
        href={photoHref}
        isPreview={isPreview}
      >
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 45%, rgba(0,0,0,.5) 100%)",
          }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute right-2 top-2 z-[2] px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,.92)",
            borderRadius: 12,
            color: "#2a3a4a",
          }}
        >
          {priceLabel}
        </span>
        <span
          className="pointer-events-none absolute bottom-2 left-2 z-[2] flex h-5 w-5 items-center justify-center rounded-full text-[7px] font-bold text-white"
          style={{
            backgroundColor: theme.color,
            border: "1.5px solid rgba(255,255,255,.7)",
          }}
        >
          {getServiceCardInitials(profile.nombre, profile.apellido)}
        </span>

        {!isPreview && (
          <button
            type="button"
            onClick={toggleFavorito}
            className="absolute left-2 top-2 z-[4] flex h-7 w-7 items-center justify-center rounded-full border-0 bg-white/90 text-xs"
            aria-label={esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
            {esFavorito ? "❤️" : "🤍"}
          </button>
        )}

        {!isPreview && !bundleMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!compareFull) onToggleComparar?.(service);
            }}
            className="absolute bottom-2 right-2 z-[2] rounded px-1.5 py-0.5 text-[8px] font-semibold text-white"
            style={{
              backgroundColor: isComparing ? theme.color : "rgba(0,0,0,.55)",
              opacity: compareFull ? 0.5 : 1,
              cursor: compareFull ? "default" : "pointer",
            }}
          >
            {isComparing ? "✓" : "＋"}
          </button>
        )}
      </ServiceCardPhotoCarousel>

      <div className="flex min-h-[108px] flex-1 flex-col px-3 py-2">
        <div className="flex min-h-[18px] items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[12px] font-semibold leading-tight text-[#1a1a1a]">
            {isPreview ? (
              <>
                <span className="font-medium text-[#2a3a4a]">
                  {formatServiceCardShortName(profile.nombre, profile.apellido) ||
                    "Proveedor"}
                </span>
                <span className="font-normal text-[#888]"> · {zone}</span>
              </>
            ) : showAnuncioLinks ? (
              <Link
                href={anuncioHref}
                onClick={(e) => e.stopPropagation()}
                className="no-underline"
                style={{ color: "inherit" }}
              >
                <span className="font-medium text-[#2a3a4a]">
                  {formatServiceCardShortName(profile.nombre, profile.apellido) ||
                    "Proveedor"}
                </span>
                <span className="font-normal text-[#888]"> · {zone}</span>
              </Link>
            ) : (
              <>
                <Link
                  href={`/proveedor/${profile.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-[#2a3a4a] no-underline"
                >
                  {formatServiceCardShortName(profile.nombre, profile.apellido) ||
                    "Proveedor"}
                </Link>
                <span className="font-normal text-[#888]"> · {zone}</span>
              </>
            )}
          </p>
          {valoracionMedia ? (
            <span className="shrink-0 text-[10px] text-[#c47d1a]">
              ★ {valoracionMedia}
            </span>
          ) : (
            <span className="shrink-0 text-[9px] text-[#ccc]">
              {emptyRatingLabel}
            </span>
          )}
        </div>

        <div className="mt-0.5 h-4 shrink-0">
          {service.titulo ? (
            showAnuncioLinks ? (
              <Link
                href={anuncioHref}
                onClick={(e) => e.stopPropagation()}
                className="block truncate text-[10px] leading-4 text-[#aaa] no-underline hover:text-[#666]"
              >
                {service.titulo}
              </Link>
            ) : (
              <p className="truncate text-[10px] leading-4 text-[#aaa]">
                {service.titulo}
              </p>
            )
          ) : null}
        </div>

        <div className="mt-1 flex h-5 shrink-0 items-center gap-1 overflow-hidden">
          {visibleTags.map((tag) => (
            <span
              key={tag.text}
              className="shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold leading-tight"
              style={{ backgroundColor: tag.light, color: tag.color }}
            >
              {tag.text}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-2">
          {!isPreview &&
            (bundleMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBundleAdd?.(service.id);
                }}
                className="block w-full rounded-md py-2 text-center text-[11px] font-semibold text-white"
                style={{ backgroundColor: theme.color }}
              >
                + Añadir a mi reserva
              </button>
            ) : (
              <>
                <Link
                  href={buildReservarHref(
                    service.id,
                    fechaBusquedaDesde,
                    fechaBusquedaHasta,
                  )}
                  onClick={(e) => e.stopPropagation()}
                  className="block w-full rounded-md py-2 text-center text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                  style={{ backgroundColor: theme.color }}
                >
                  {reservarLabel}
                </Link>
                {!isPreview && (
                  <Link
                    href={`/proveedor/${profile.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 block text-center text-[10px] text-[#999] no-underline hover:text-[#666]"
                  >
                    Ver perfil del proveedor
                  </Link>
                )}
              </>
            ))}
        </div>
      </div>
    </>
  );

  if (isPreview) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-white text-left">
        {cardBody}
      </div>
    );
  }

  return (
    <li className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(e);
          }
        }}
        onMouseEnter={() => onHover?.(index)}
        onMouseLeave={() => onLeave?.()}
        className="flex h-full min-h-0 w-full cursor-pointer flex-col overflow-hidden border-b text-left transition-colors"
        style={{
          borderColor: "#e8e4de",
          borderLeft: isActive ? "2px solid #1d4f91" : "2px solid transparent",
          backgroundColor: isActive ? "#fafaf9" : "#fff",
        }}
      >
        {cardBody}
      </div>
    </li>
  );
}
