"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  buildAnuncioHref,
  buildReservarHref,
  formatServiceCardPrice,
  formatServiceCardShortName,
  getServiceCardInitials,
  getServiceCardTags,
  getServiceCardTheme,
  getServiceCardZone,
  getServicePhotos,
  normalizeServiceProfile,
} from "@/app/lib/service-card-display";

/**
 * Tarjeta de servicio en búsqueda (y vista previa del wizard).
 *
 * @param {object} props
 * @param {object} props.service — fila de services + profiles_public anidado
 * @param {boolean} [props.isPreview]
 * @param {number} [props.index]
 * @param {boolean} [props.isActive]
 * @param {function} [props.onHover]
 * @param {function} [props.onLeave]
 * @param {function} [props.onSelect]
 * @param {object} [props.extra]
 * @param {object} [props.t]
 * @param {string} [props.lang]
 * @param {boolean} [props.bundleMode]
 * @param {function} [props.onBundleAdd]
 * @param {Record<string, { sum: number, count: number }>} [props.ratingsByProveedor]
 * @param {object[]} [props.comparando]
 * @param {function} [props.onToggleComparar]
 * @param {string[]} [props.favoritos]
 * @param {string} [props.fechaBusquedaDesde]
 * @param {string} [props.fechaBusquedaHasta]
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
  const tags = service
    ? getServiceCardTags(service, profile, lang, { isPreview })
    : [];
  const priceLabel = formatServiceCardPrice(service?.precio, theme.priceSuffix);
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
  const primaryPhoto = photos[0] ?? null;
  const extraPhotoCount = photos.length > 1 ? photos.length - 1 : 0;
  const anuncioHref = buildAnuncioHref(
    service.id,
    fechaBusquedaDesde,
    fechaBusquedaHasta,
  );
  const showAnuncioLinks = !isPreview && !bundleMode;

  const toggleFavorito = async (e) => {
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

  const cardBody = (
    <>
      <div
        className="relative h-[160px] w-full overflow-hidden"
        style={{ position: "relative" }}
      >
        {isPreview ? (
          <div className="block h-full w-full">
            {primaryPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryPhoto}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: theme.gradient }}
              />
            )}
          </div>
        ) : showAnuncioLinks ? (
          <Link
            href={anuncioHref}
            onClick={(e) => e.stopPropagation()}
            className="block h-full w-full"
          >
            {primaryPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryPhoto}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: theme.gradient }}
              />
            )}
          </Link>
        ) : (
          <Link
            href={`/proveedor/${profile.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block h-full w-full"
          >
            {primaryPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryPhoto}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: theme.gradient }}
              />
            )}
          </Link>
        )}

        {extraPhotoCount > 0 ? (
          <span
            className="pointer-events-none absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: "rgba(0,0,0,.62)" }}
          >
            +{extraPhotoCount} {extraPhotoCount === 1 ? "foto" : "fotos"}
          </span>
        ) : null}

        {!isPreview && (
          <button
            type="button"
            onClick={toggleFavorito}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(255,255,255,.9)",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 14,
              zIndex: 2,
            }}
          >
            {esFavorito ? "❤️" : "🤍"}
          </button>
        )}

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.55) 100%)",
          }}
          aria-hidden
        />
        <span
          className="absolute right-2.5 top-2.5 px-2.5 py-1 text-[10px] font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,.92)",
            borderRadius: 14,
            color: "#2a3a4a",
          }}
        >
          {priceLabel}
        </span>
        <span
          className="absolute bottom-2 left-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{
            backgroundColor: theme.color,
            border: "1.5px solid rgba(255,255,255,.7)",
          }}
        >
          {getServiceCardInitials(profile.nombre, profile.apellido)}
        </span>

        {!isPreview && !bundleMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!compareFull) onToggleComparar?.(service);
            }}
            className="absolute bottom-2 right-2 rounded px-2 py-1 text-[9px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: isComparing ? theme.color : "rgba(0,0,0,.55)",
              opacity: compareFull ? 0.5 : 1,
              cursor: compareFull ? "default" : "pointer",
            }}
          >
            {isComparing ? "✓ Añadido" : "＋ Comparar"}
          </button>
        )}
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[12px] font-semibold text-[#1a1a1a]">
            {isPreview ? (
              <>
                <span style={{ color: "#2a3a4a", fontWeight: 500 }}>
                  {formatServiceCardShortName(profile.nombre, profile.apellido) ||
                    "Proveedor"}
                </span>
                <span className="font-normal text-[#888]"> · {zone}</span>
              </>
            ) : (
              <>
                <Link
                  href={`/proveedor/${profile.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    color: "#2a3a4a",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
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
              ★ {valoracionMedia} ({numReviews})
            </span>
          ) : (
            <span className="shrink-0 text-[10px]" style={{ color: "#bbb" }}>
              {emptyRatingLabel}
            </span>
          )}
        </div>

        {service.titulo &&
          (showAnuncioLinks ? (
            <Link
              href={anuncioHref}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 block truncate text-[10px] text-[#aaa] no-underline transition-colors hover:text-[#666]"
            >
              {service.titulo}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-[10px] text-[#aaa]">
              {service.titulo}
            </p>
          ))}

        {(tags.length > 0 ||
          (!isPreview &&
            (profile.badge_respuesta === "rapido" ||
              profile.badge_respuesta === "pocas_horas"))) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.text}
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ backgroundColor: tag.light, color: tag.color }}
              >
                {tag.text}
              </span>
            ))}
            {!isPreview && profile.badge_respuesta === "rapido" && (
              <span
                className="rct rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: "#e6f4f0", color: "#085041" }}
              >
                ⚡ Responde rápido
              </span>
            )}
            {!isPreview && profile.badge_respuesta === "pocas_horas" && (
              <span
                className="rct n rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: "#fdf3e3", color: "#92400e" }}
              >
                🕐 Responde en pocas horas
              </span>
            )}
          </div>
        )}

        {!isPreview &&
          (bundleMode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBundleAdd?.(service.id);
              }}
              className="mt-2 block w-full rounded py-2 text-center text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.color }}
            >
              + Añadir a mi reserva
            </button>
          ) : (
            <>
              <Link
                href={anuncioHref}
                onClick={(e) => e.stopPropagation()}
                className="mt-2 block w-full rounded py-2 text-center text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.color }}
              >
                Ver anuncio
              </Link>
              <Link
                href={`/proveedor/${profile.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 block w-full rounded border py-2 text-center text-[11px] font-medium no-underline transition-colors hover:bg-[#f7f5f2]"
                style={{
                  borderColor: "#e8e4de",
                  color: "#666",
                }}
              >
                Ver perfil
              </Link>
              <Link
                href={buildReservarHref(
                  service.id,
                  fechaBusquedaDesde,
                  fechaBusquedaHasta,
                )}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 block w-full rounded py-2 text-center text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.color }}
              >
                {typeof extra?.reservar === "function"
                  ? extra.reservar(
                      service.precio != null && service.precio !== ""
                        ? `${Number(service.precio)}€`
                        : "—",
                      theme.priceSuffix,
                    )
                  : `Reservar · ${priceLabel}`}
              </Link>
            </>
          ))}
      </div>
    </>
  );

  if (isPreview) {
    return (
      <div
        className="w-full overflow-hidden bg-white text-left"
        style={{ borderColor: "#e8e4de" }}
      >
        {cardBody}
      </div>
    );
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(index);
          }
        }}
        onMouseEnter={() => onHover?.(index)}
        onMouseLeave={() => onLeave?.()}
        className="w-full cursor-pointer overflow-hidden border-b text-left transition-colors"
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
