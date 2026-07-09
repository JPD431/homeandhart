"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PhotoArchProgressBar from "@/app/components/PhotoArchProgressBar";
import { getServiceCardTheme } from "@/app/lib/service-card-display";
import { photoArchStyle } from "@/app/lib/photo-arch-shape";

function ArchPlaceholder({ vertical, style = {}, className = "" }) {
  const theme = getServiceCardTheme(vertical);
  return (
    <div
      className={`flex min-h-[200px] w-full items-center justify-center ${className}`}
      style={{
        ...photoArchStyle("main"),
        background: theme.gradient,
        maxHeight: "min(55vh, 420px)",
        ...style,
      }}
      aria-hidden
    >
      <span className="text-4xl opacity-40">🏠</span>
    </div>
  );
}

function Lightbox({ photos, index, onClose, onChangeIndex }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        onChangeIndex((index - 1 + photos.length) % photos.length);
      }
      if (e.key === "ArrowRight") {
        onChangeIndex((index + 1) % photos.length);
      }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [index, onChangeIndex, onClose, photos.length]);

  const [touchStartX, setTouchStartX] = useState(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de fotos"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white"
        aria-label="Cerrar"
      >
        ×
      </button>
      <p className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-sm font-medium text-white/90">
        {index + 1} / {photos.length}
      </p>
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index - 1 + photos.length) % photos.length);
            }}
            className="absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white sm:flex"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index + 1) % photos.length);
            }}
            className="absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white sm:flex"
            aria-label="Siguiente"
          >
            ›
          </button>
        </>
      ) : null}
      <div
        className="relative mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 py-16"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchStartX == null || photos.length <= 1) return;
          const delta = e.changedTouches[0]?.clientX - touchStartX;
          if (Math.abs(delta) < 40) return;
          if (delta > 0) {
            onChangeIndex((index - 1 + photos.length) % photos.length);
          } else {
            onChangeIndex((index + 1) % photos.length);
          }
          setTouchStartX(null);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element — lightbox: foto completa, sin arco */}
        <img
          src={photos[index]}
          alt=""
          className="max-h-[85vh] max-w-full object-contain"
        />
      </div>
    </div>
  );
}

function MobileCarousel({ photos, vertical, onOpenLightbox }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);
  const scrollRef = useRef(null);

  const goTo = useCallback(
    (index) => {
      const wrapped = ((index % photos.length) + photos.length) % photos.length;
      setActiveIndex(wrapped);
      scrollRef.current?.children[wrapped]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    },
    [photos.length],
  );

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || photos.length <= 1) return;
          const delta =
            (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 40) return;
          if (delta > 0) goTo(activeIndex - 1);
          else goTo(activeIndex + 1);
        }}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el || !el.children.length) return;
          const w = el.offsetWidth;
          const idx = Math.round(el.scrollLeft / w);
          if (idx !== activeIndex && idx >= 0 && idx < photos.length) {
            setActiveIndex(idx);
          }
        }}
      >
        {photos.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => onOpenLightbox(index)}
            className="relative mx-1 w-[calc(100%-0.5rem)] shrink-0 snap-center first:ml-0 last:mr-0"
            style={{
              ...photoArchStyle("mobile"),
              height: "min(52vh, 340px)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
            />
          </button>
        ))}
      </div>
      <PhotoArchProgressBar
        count={photos.length}
        activeIndex={activeIndex}
        vertical={vertical}
        className="mt-2 px-1"
      />
    </div>
  );
}

function ArchPhotoButton({
  url,
  variant = "main",
  className = "",
  style = {},
  onClick,
  overlay = null,
  bottomAction = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block h-full w-full ${className}`}
      style={{ ...photoArchStyle(variant), ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {overlay}
      {bottomAction}
    </button>
  );
}

/**
 * Galería hero del anuncio — arco Home&Heart + lightbox rectangular.
 */
export default function ServicePhotoGalleryHero({
  photos = [],
  vertical = "alojamiento",
  className = "",
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const openLightbox = useCallback((index) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const heroMaxHeight = "min(58vh, 420px)";

  if (!photos.length) {
    return (
      <ArchPlaceholder
        vertical={vertical}
        className={className}
        style={{ maxHeight: heroMaxHeight }}
      />
    );
  }

  const verFotosButton = (
    <span className="absolute bottom-3 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-[#1a1a1a] shadow-md">
      Ver {photos.length} {photos.length === 1 ? "foto" : "fotos"}
    </span>
  );

  if (photos.length === 1) {
    return (
      <>
        <div className={className} style={{ maxHeight: heroMaxHeight }}>
          <ArchPhotoButton
            url={photos[0]}
            variant="main"
            style={{ height: heroMaxHeight, maxHeight: heroMaxHeight }}
            onClick={() => openLightbox(0)}
            bottomAction={verFotosButton}
          />
        </div>
        {lightboxIndex != null ? (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            onClose={closeLightbox}
            onChangeIndex={setLightboxIndex}
          />
        ) : null}
      </>
    );
  }

  const thumbTop = photos[1];
  const thumbBottom = photos[2];
  const extraCount = photos.length - 3;

  return (
    <>
      <div className={`md:hidden ${className}`}>
        <MobileCarousel
          photos={photos}
          vertical={vertical}
          onOpenLightbox={openLightbox}
        />
      </div>

      <div
        className={`hidden gap-2 md:grid md:grid-cols-3 ${className}`}
        style={{ maxHeight: heroMaxHeight, height: heroMaxHeight }}
      >
        <div className="col-span-2 h-full min-h-0">
          <ArchPhotoButton
            url={photos[0]}
            variant="main"
            className="h-full"
            onClick={() => openLightbox(0)}
            bottomAction={verFotosButton}
          />
        </div>

        <div className="flex h-full min-h-0 flex-col gap-2">
          {thumbTop ? (
            <div className="min-h-0 flex-1">
              <ArchPhotoButton
                url={thumbTop}
                variant="thumb"
                className="h-full"
                onClick={() => openLightbox(1)}
              />
            </div>
          ) : null}
          {thumbBottom ? (
            <div className="relative min-h-0 flex-1">
              <ArchPhotoButton
                url={thumbBottom}
                variant="thumb"
                className="h-full"
                onClick={() => openLightbox(2)}
                overlay={
                  extraCount > 0 ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-base font-semibold text-white">
                      +{extraCount} {extraCount === 1 ? "foto" : "fotos"}
                    </span>
                  ) : null
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      {lightboxIndex != null ? (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onChangeIndex={setLightboxIndex}
        />
      ) : null}
    </>
  );
}
