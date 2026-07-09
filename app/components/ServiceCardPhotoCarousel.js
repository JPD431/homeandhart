"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PhotoArchProgressBar from "@/app/components/PhotoArchProgressBar";
import { getServiceCardTheme } from "@/app/lib/service-card-display";
import { photoArchStyle } from "@/app/lib/photo-arch-shape";

/**
 * Carrusel de fotos para ServiceCard (/buscar + wizard preview).
 * Flechas y barra NO propagan clic al contenedor padre (enlace al anuncio).
 */
export default function ServiceCardPhotoCarousel({
  photos = [],
  vertical = "alojamiento",
  href = null,
  isPreview = false,
  className = "",
  height = 160,
  children = null,
}) {
  const theme = getServiceCardTheme(vertical);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [preloadedIndices, setPreloadedIndices] = useState(() => new Set([0]));
  const touchStartX = useRef(null);

  const count = photos.length;
  const hasCarousel = count > 1;

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const preloadIndex = useCallback(
    (index) => {
      if (index < 0 || index >= count) return;
      setPreloadedIndices((prev) => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    },
    [count],
  );

  const goTo = useCallback(
    (index) => {
      if (count <= 1) return;
      markInteracted();
      const wrapped = ((index % count) + count) % count;
      setActiveIndex(wrapped);
      preloadIndex(wrapped);
      preloadIndex((wrapped + 1) % count);
    },
    [count, markInteracted, preloadIndex],
  );

  const goPrev = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      goTo(activeIndex - 1);
    },
    [activeIndex, goTo],
  );

  const goNext = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      goTo(activeIndex + 1);
    },
    [activeIndex, goTo],
  );

  useEffect(() => {
    if (!hasInteracted || count <= 1) return;
    const next = (activeIndex + 1) % count;
    const img = new window.Image();
    img.src = photos[next];
  }, [activeIndex, count, hasInteracted, photos]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null || count <= 1) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    e.stopPropagation();
    markInteracted();
    if (delta > 0) goTo(activeIndex - 1);
    else goTo(activeIndex + 1);
  };

  const archContainerStyle = {
    ...photoArchStyle("card"),
    height,
    position: "relative",
  };

  const photoLayer =
    count > 0 ? (
      photos.map((url, i) =>
        preloadedIndices.has(i) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            loading={i === 0 ? "lazy" : "eager"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
            style={{
              opacity: i === activeIndex ? 1 : 0,
              pointerEvents: "none",
            }}
          />
        ) : null,
      )
    ) : (
      <div className="absolute inset-0 h-full w-full" style={{ background: theme.gradient }} />
    );

  return (
    <div className={className}>
      <div
        className="group/card-photo relative w-full"
        style={archContainerStyle}
        onTouchStart={hasCarousel ? handleTouchStart : undefined}
        onTouchEnd={hasCarousel ? handleTouchEnd : undefined}
      >
        {href && !isPreview ? (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-0 block"
            aria-label="Ver anuncio"
          >
            {photoLayer}
          </Link>
        ) : (
          <div className="absolute inset-0 z-0">{photoLayer}</div>
        )}

        {children}

        {hasCarousel ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-1.5 top-1/2 z-[5] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-[#333] shadow-sm transition-opacity opacity-100 md:opacity-0 md:group-hover/card-photo:opacity-100"
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-1.5 top-1/2 z-[5] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-[#333] shadow-sm transition-opacity opacity-100 md:opacity-0 md:group-hover/card-photo:opacity-100"
              aria-label="Foto siguiente"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {hasCarousel ? (
        <PhotoArchProgressBar
          count={count}
          activeIndex={activeIndex}
          vertical={vertical}
          className="mt-1.5 px-0.5"
        />
      ) : null}
    </div>
  );
}
