/**
 * Precio por unidad (alojamiento / niñera / mascotas):
 * capacidad_maxima + huespedes_incluidos + precio_huesped_extra
 * (nombres históricos; semántica = unidades según vertical).
 *
 * NULL / precio_huesped_extra 0 = precio plano (retrocompatible).
 *
 * CÁLCULO DE RESERVA (Paso 2): solo activo en alojamiento por ahora
 * (serviceHasHuespedesModelo). ninos/mascotas: config + anuncio en Paso 1;
 * el precio de reserva sigue plano hasta su Paso 2.
 */

export const VERTICALES_UNIDADES_PRECIO = ["alojamiento", "ninos", "mascotas"];

/** Copy / etiquetas por vertical (UI + anuncio). */
export const UNIDADES_PRECIO_COPY = {
  alojamiento: {
    unitSingular: "huésped",
    unitPlural: "huéspedes",
    priceUnit: "noche",
    title: "Capacidad y precio por huésped",
    maxLabel: "Capacidad máxima de huéspedes",
    incluidosLabel: "Incluidos en el precio base",
    extraLabel: "Precio por huésped adicional (€)",
    maxGteIncluidos:
      "La capacidad máxima debe ser mayor o igual que los huéspedes incluidos en el precio.",
    incluidosRequired:
      "Indica cuántos huéspedes incluye el precio base.",
    extraNegativo:
      "El precio por huésped adicional no puede ser negativo.",
  },
  ninos: {
    unitSingular: "niño",
    unitPlural: "niños",
    priceUnit: "hora",
    title: "Capacidad y precio por niño",
    maxLabel: "Máximo de niños",
    incluidosLabel: "Niños incluidos en el precio base",
    extraLabel: "Precio por niño adicional (€/hora)",
    maxGteIncluidos:
      "El máximo de niños debe ser mayor o igual que los niños incluidos en el precio.",
    incluidosRequired: "Indica cuántos niños incluye el precio base.",
    extraNegativo: "El precio por niño adicional no puede ser negativo.",
  },
  mascotas: {
    unitSingular: "mascota",
    unitPlural: "mascotas",
    priceUnit: "día",
    title: "Capacidad y precio por mascota",
    maxLabel: "Máximo de mascotas",
    incluidosLabel: "Mascotas incluidas en el precio base",
    extraLabel: "Precio por mascota adicional (€/día)",
    maxGteIncluidos:
      "El máximo de mascotas debe ser mayor o igual que las mascotas incluidas en el precio.",
    incluidosRequired: "Indica cuántas mascotas incluye el precio base.",
    extraNegativo: "El precio por mascota adicional no puede ser negativo.",
  },
};

export function supportsUnidadesPrecio(vertical) {
  return VERTICALES_UNIDADES_PRECIO.includes(vertical);
}

export function getUnidadesPrecioCopy(vertical) {
  return UNIDADES_PRECIO_COPY[vertical] ?? UNIDADES_PRECIO_COPY.alojamiento;
}

/**
 * True solo si el servicio tiene el modelo base + suplemento (cálculo reserva).
 * Paso 1 ninos/mascotas: config sí, cálculo reserva aún no → solo alojamiento.
 */
export function serviceHasHuespedesModelo(svc) {
  if (!svc || svc.vertical !== "alojamiento") return false;

  const max = Number(svc.capacidad_maxima);
  const incluidos = Number(svc.huespedes_incluidos);
  const extra = Number(svc.precio_huesped_extra);

  return (
    Number.isFinite(max) &&
    max > 0 &&
    Number.isFinite(incluidos) &&
    incluidos > 0 &&
    Number.isFinite(extra) &&
    extra > 0
  );
}

/**
 * Suplemento €/noche por huéspedes por encima de los incluidos.
 * Sin modelo → 0 (no altera el precio). Solo alojamiento (Paso 2).
 */
export function getHuespedesSuplementoPorNoche(svc, numHuespedes) {
  if (!serviceHasHuespedesModelo(svc)) return 0;

  const incluidos = Math.floor(Number(svc.huespedes_incluidos));
  const extra = Number(svc.precio_huesped_extra);
  const n = resolveNumHuespedesValue(svc, numHuespedes);
  if (n == null) return 0;

  return Math.max(0, n - incluidos) * extra;
}

/**
 * Valor entero de huéspedes a usar en precio (default = incluidos).
 * No valida capacidad; usar validateNumHuespedesParaReserva en servidor.
 */
export function resolveNumHuespedesValue(svc, numHuespedes) {
  if (!serviceHasHuespedesModelo(svc)) return null;

  const incluidos = Math.floor(Number(svc.huespedes_incluidos));
  if (numHuespedes == null || numHuespedes === "") return incluidos;

  const n = Number(numHuespedes);
  if (!Number.isFinite(n)) return incluidos;
  return Math.floor(n);
}

/**
 * Valida num_huespedes para un servicio con modelo (reserva alojamiento).
 * @returns {{ ok: true, num: number|null } | { ok: false, error: string }}
 */
export function validateNumHuespedesParaReserva(svc, numHuespedes) {
  if (!serviceHasHuespedesModelo(svc)) {
    return { ok: true, num: null };
  }

  const max = Math.floor(Number(svc.capacidad_maxima));
  const incluidos = Math.floor(Number(svc.huespedes_incluidos));

  let n;
  if (numHuespedes == null || numHuespedes === "") {
    n = incluidos;
  } else {
    n = Number(numHuespedes);
    if (!Number.isFinite(n) || Math.floor(n) !== n) {
      return { ok: false, error: "El número de huéspedes no es válido." };
    }
    n = Math.floor(n);
  }

  if (n < 1) {
    return { ok: false, error: "Debe haber al menos 1 huésped." };
  }
  if (n > max) {
    return {
      ok: false,
      error: `Este alojamiento admite un máximo de ${max} huésped${max === 1 ? "" : "es"}.`,
    };
  }

  return { ok: true, num: n };
}

/**
 * Desglose legible para el cliente (reserva alojamiento), ej.
 * "2 huéspedes incluidos · +2 huéspedes × 5€ = +10€/noche"
 */
export function formatHuespedesPrecioDesglose(svc, numHuespedes) {
  if (!serviceHasHuespedesModelo(svc)) return null;

  const incluidos = Math.floor(Number(svc.huespedes_incluidos));
  const extra = Number(svc.precio_huesped_extra);
  const n = resolveNumHuespedesValue(svc, numHuespedes) ?? incluidos;
  const extras = Math.max(0, n - incluidos);
  const inclLabel = `${incluidos} huésped${incluidos === 1 ? "" : "es"} incluidos`;

  if (extras === 0) return inclLabel;

  const euro =
    Number.isInteger(extra) ? String(extra) : extra.toFixed(2).replace(/\.?0+$/, "");
  const suplemento = Math.round(extras * extra * 100) / 100;
  const suplStr = Number.isInteger(suplemento)
    ? String(suplemento)
    : suplemento.toFixed(2).replace(/\.?0+$/, "");

  return `${inclLabel} · +${extras} huésped${extras === 1 ? "" : "es"} × ${euro}€ = +${suplStr}€/noche`;
}

/**
 * @param {object|null|undefined} row — fila services
 */
export function parseHuespedesPrecioFromDb(row) {
  const maxRaw = row?.capacidad_maxima;
  const incRaw = row?.huespedes_incluidos;
  const extraRaw = row?.precio_huesped_extra;

  let capacidad_maxima = "";
  if (maxRaw != null && maxRaw !== "") {
    const n = Number(maxRaw);
    if (Number.isFinite(n) && n > 0) capacidad_maxima = String(Math.floor(n));
  } else if (row?.vertical === "alojamiento" || row?.vertical == null) {
    // Fallback visual solo alojamiento (capacidad.personas jsonb)
    const personas = row?.capacidad?.personas;
    if (personas != null && personas !== "") {
      const n = Number(personas);
      if (Number.isFinite(n) && n > 0) capacidad_maxima = String(Math.floor(n));
    }
  }

  let huespedes_incluidos = "";
  if (incRaw != null && incRaw !== "") {
    const n = Number(incRaw);
    if (Number.isFinite(n) && n > 0) huespedes_incluidos = String(Math.floor(n));
  }

  let precio_huesped_extra = "";
  if (extraRaw != null && extraRaw !== "") {
    const n = Number(extraRaw);
    if (Number.isFinite(n) && n >= 0) {
      precio_huesped_extra = String(n);
    }
  }

  return {
    capacidad_maxima,
    huespedes_incluidos,
    precio_huesped_extra,
  };
}

/**
 * Serializa para INSERT/UPDATE en services (alojamiento, ninos, mascotas).
 * Otras verticales → NULL.
 */
export function serializeHuespedesPrecioForDb(details, vertical) {
  if (!supportsUnidadesPrecio(vertical)) {
    return {
      capacidad_maxima: null,
      huespedes_incluidos: null,
      precio_huesped_extra: null,
    };
  }

  const max = parseOptionalPositiveInt(details?.capacidad_maxima);
  const incluidos = parseOptionalPositiveInt(details?.huespedes_incluidos);
  const extra = parseOptionalNonNegativeNumber(details?.precio_huesped_extra);

  return {
    capacidad_maxima: max,
    huespedes_incluidos: incluidos,
    precio_huesped_extra: extra,
  };
}

function parseOptionalPositiveInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parseOptionalNonNegativeNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return null; // 0 = sin suplemento → guardar NULL
  return Math.round(n * 100) / 100;
}

/**
 * Validación de formulario (alojamiento / ninos / mascotas).
 * @returns {string|null} mensaje de error o null si OK
 */
export function validateHuespedesPrecio(details, vertical) {
  if (!supportsUnidadesPrecio(vertical)) return null;

  const copy = getUnidadesPrecioCopy(vertical);
  const max = parseOptionalPositiveInt(details?.capacidad_maxima);
  const incluidos = parseOptionalPositiveInt(details?.huespedes_incluidos);
  const extraRaw = details?.precio_huesped_extra;

  if (extraRaw != null && extraRaw !== "") {
    const n = Number(extraRaw);
    if (!Number.isFinite(n) || n < 0) {
      return copy.extraNegativo;
    }
  }

  if (max != null && incluidos != null && max < incluidos) {
    return copy.maxGteIncluidos;
  }

  if (
    incluidos == null &&
    max != null &&
    extraRaw != null &&
    extraRaw !== "" &&
    Number(extraRaw) > 0
  ) {
    return copy.incluidosRequired;
  }

  return null;
}

/**
 * Texto informativo para el anuncio (sin afectar precio de reserva en ninos/mascotas aún).
 * @param {object} service
 * @returns {string|null}
 */
export function formatHuespedesPrecioInfo(service) {
  const vertical = service?.vertical || "alojamiento";
  if (!supportsUnidadesPrecio(vertical)) return null;

  const copy = getUnidadesPrecioCopy(vertical);
  const max =
    service?.capacidad_maxima != null
      ? Number(service.capacidad_maxima)
      : null;
  const incluidos =
    service?.huespedes_incluidos != null
      ? Number(service.huespedes_incluidos)
      : null;
  const extra =
    service?.precio_huesped_extra != null
      ? Number(service.precio_huesped_extra)
      : null;

  const hasMax = Number.isFinite(max) && max > 0;
  const hasInc = Number.isFinite(incluidos) && incluidos > 0;
  const hasExtra = Number.isFinite(extra) && extra > 0;

  if (!hasMax && !hasInc && !hasExtra) return null;

  const parts = [];
  if (hasMax) {
    const n = Math.floor(max);
    const word = n === 1 ? copy.unitSingular : copy.unitPlural;
    parts.push(`Hasta ${n} ${word}`);
  }
  if (hasInc) {
    parts.push(`incluye ${Math.floor(incluidos)}`);
  }
  if (hasExtra) {
    const euro =
      Number.isInteger(extra) ? String(extra) : extra.toFixed(2).replace(/\.?0+$/, "");
    parts.push(
      `+${euro}€/${copy.priceUnit} por ${copy.unitSingular} adicional`,
    );
  }

  return parts.join(" · ");
}
