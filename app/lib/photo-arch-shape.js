/**
 * Forma de arco Home&Heart — puerta/ventana (hogar).
 * Curvatura suave arriba, esquinas inferiores discretas. Valores fijos (no escalan).
 */
export const PHOTO_ARCH_VARIANTS = {
  main: { top: 24, bottom: 8 },
  thumb: { top: 16, bottom: 6 },
  card: { top: 22, bottom: 12 },
  mobile: { top: 20, bottom: 8 },
};

/** Proporciones de contenedor de foto (presentación). */
export const PHOTO_ASPECT = {
  /** Portada y carrusel del anuncio */
  heroMain: "3 / 2",
  /** Tarjeta /buscar y wizard */
  card: "4 / 3",
};

export const PHOTO_SIZE = {
  heroMaxHeight: 420,
  cardMaxHeight: 190,
};

/** Imagen dentro de contenedor con aspect-ratio fijo */
export const PHOTO_COVER_CLASS =
  "absolute inset-0 h-full w-full object-cover object-center";

/**
 * @param {'main'|'thumb'|'card'|'mobile'} [variant='main']
 * @returns {string}
 */
export function photoArchBorderRadius(variant = "main") {
  const cfg = PHOTO_ARCH_VARIANTS[variant] ?? PHOTO_ARCH_VARIANTS.main;
  const { top, bottom } = cfg;
  return `${top}px ${top}px ${bottom}px ${bottom}px`;
}

/**
 * @param {'main'|'thumb'|'card'|'mobile'} [variant='main']
 * @returns {{ borderRadius: string, overflow: 'hidden' }}
 */
export function photoArchStyle(variant = "main") {
  return {
    borderRadius: photoArchBorderRadius(variant),
    overflow: "hidden",
  };
}

/**
 * Estilo de contenedor con aspect-ratio + tope de altura.
 * @param {'heroMain'|'card'} aspectKey
 * @param {number} [maxHeightPx]
 */
export function photoFrameStyle(aspectKey = "heroMain", maxHeightPx = null) {
  const maxH =
    maxHeightPx ??
    (aspectKey === "card" ? PHOTO_SIZE.cardMaxHeight : PHOTO_SIZE.heroMaxHeight);
  return {
    aspectRatio: PHOTO_ASPECT[aspectKey],
    maxHeight: maxH,
    width: "100%",
    position: "relative",
  };
}

export const PHOTO_ARCH_CLIP_CLASS = "overflow-hidden";
