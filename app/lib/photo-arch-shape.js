/**
 * Forma de arco Home&Heart — puerta/ventana (hogar).
 * Curvatura suave arriba, esquinas inferiores discretas.
 * Ratio top:bottom ≈ 3.2:1 (ajustable en PHOTO_ARCH_RATIO).
 */
export const PHOTO_ARCH_RATIO = {
  top: 32,
  bottom: 10,
};

/** Variantes de referencia (px) para afinar por contexto. */
export const PHOTO_ARCH_VARIANTS = {
  /** Portada del anuncio (escritorio) */
  main: { top: 32, bottom: 10, refWidth: 520 },
  /** Miniaturas del anuncio */
  thumb: { top: 22, bottom: 8, refWidth: 260 },
  /** Tarjeta /buscar y wizard (~160px alto) */
  card: { top: 20, bottom: 6, refWidth: 320 },
  /** Carrusel móvil del anuncio */
  mobile: { top: 28, bottom: 9, refWidth: 390 },
};

/**
 * @param {'main'|'thumb'|'card'|'mobile'} [variant='main']
 * @param {number|null} [widthPx] — escala la curvatura al ancho real del contenedor
 * @returns {string} valor CSS border-radius (top-left top-right bottom-right bottom-left)
 */
export function photoArchBorderRadius(variant = "main", widthPx = null) {
  const cfg = PHOTO_ARCH_VARIANTS[variant] ?? PHOTO_ARCH_VARIANTS.main;
  let top = cfg.top;
  let bottom = cfg.bottom;

  if (widthPx != null && cfg.refWidth > 0) {
    const scale = widthPx / cfg.refWidth;
    top = Math.round(cfg.top * scale);
    bottom = Math.max(4, Math.round(cfg.bottom * scale));
  }

  return `${top}px ${top}px ${bottom}px ${bottom}px`;
}

/**
 * @param {'main'|'thumb'|'card'|'mobile'} [variant='main']
 * @param {number|null} [widthPx]
 * @returns {{ borderRadius: string, overflow: 'hidden' }}
 */
export function photoArchStyle(variant = "main", widthPx = null) {
  return {
    borderRadius: photoArchBorderRadius(variant, widthPx),
    overflow: "hidden",
  };
}

/** Clase Tailwind opcional (contenedor con overflow hidden). */
export const PHOTO_ARCH_CLIP_CLASS = "overflow-hidden";
