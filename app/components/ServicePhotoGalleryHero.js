"use client";

import { useCallback, useEffect, useState } from "react";
import { getServiceCardTheme } from "@/app/lib/service-card-display";

function Placeholder({ vertical, className = "", minHeight = 280 }) {
  const theme = getServiceCardTheme(vertical);
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ background: theme.gradient, minHeight }}
      aria-hidden
    />
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt=""
          className="max-h-[85vh] max-w-full object-contain"
        />
      </div>
    </div>
  );
}

/**
 * Galería hero estilo Airbnb + lightbox a pantalla completa.
 */
export default function ServicePhotoGalleryHero({
  photos = [],
  vertical = "alojamiento",
  className = "",
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const theme = getServiceCardTheme(vertical);

  const openLightbox = useCallback((index) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  if (!photos.length) {
    return <Placeholder vertical={vertical} className={className} minHeight={280} />;
  }

  if (photos.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className={`block w-full overflow-hidden ${className}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0]}
            alt=""
            className="h-[min(480px,55vh)] w-full object-cover"
          />
        </button>
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

  const sidePhotos = photos.slice(1, 5);
  const extraCount = photos.length - 5;

  return (
    <>
      <div className={`md:hidden ${className}`}>
        <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          {photos.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => openLightbox(index)}
              className="relative h-64 w-full shrink-0 snap-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                {index + 1} / {photos.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`hidden max-h-[min(480px,55vh)] grid-cols-4 grid-rows-2 gap-2 overflow-hidden md:grid ${className}`}
      >
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="relative col-span-2 row-span-2 overflow-hidden rounded-l-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt="" className="h-full w-full object-cover" />
        </button>
        {sidePhotos.map((url, i) => {
          const globalIndex = i + 1;
          const isLastCell = i === sidePhotos.length - 1 && extraCount > 0;
          const roundedClass =
            globalIndex === 2
              ? "rounded-tr-xl"
              : globalIndex === 4 ||
                  (sidePhotos.length <= 2 && globalIndex === sidePhotos.length)
                ? "rounded-br-xl"
                : "";

          return (
            <button
              key={`${url}-${globalIndex}`}
              type="button"
              onClick={() => openLightbox(globalIndex)}
              className={`relative overflow-hidden ${roundedClass}`}
              style={{ minHeight: 120 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {isLastCell ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white">
                  +{extraCount} fotos
                </span>
              ) : null}
            </button>
          );
        })}
        {sidePhotos.length < 4
          ? Array.from({ length: 4 - sidePhotos.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{ background: theme.gradient, minHeight: 120 }}
                aria-hidden
              />
            ))
          : null}
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
