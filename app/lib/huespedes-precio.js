/**
 * Precio por huésped (alojamiento): configuración del anuncio.
 * No afecta al cálculo de reserva hasta el Paso 2.
 * Campos NULL = comportamiento precio plano actual.
 */

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
  } else {
    // Fallback visual desde capacidad.personas (jsonb informativo)
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
 * Serializa para INSERT/UPDATE en services (solo alojamiento).
 * @param {object} details
 * @param {string} vertical
 */
export function serializeHuespedesPrecioForDb(details, vertical) {
  if (vertical !== "alojamiento") {
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
 * Validación de formulario (alojamiento).
 * @returns {string|null} mensaje de error o null si OK
 */
export function validateHuespedesPrecio(details, vertical) {
  if (vertical !== "alojamiento") return null;

  const max = parseOptionalPositiveInt(details?.capacidad_maxima);
  const incluidos = parseOptionalPositiveInt(details?.huespedes_incluidos);
  const extraRaw = details?.precio_huesped_extra;

  if (extraRaw != null && extraRaw !== "") {
    const n = Number(extraRaw);
    if (!Number.isFinite(n) || n < 0) {
      return "El precio por huésped adicional no puede ser negativo.";
    }
  }

  if (max != null && incluidos != null && max < incluidos) {
    return "La capacidad máxima debe ser mayor o igual que los huéspedes incluidos en el precio.";
  }

  if (incluidos == null && max != null && extraRaw != null && extraRaw !== "" && Number(extraRaw) > 0) {
    return "Indica cuántos huéspedes incluye el precio base.";
  }

  return null;
}

/**
 * Texto informativo para el anuncio (sin afectar precio aún).
 * @param {object} service
 * @returns {string|null}
 */
export function formatHuespedesPrecioInfo(service) {
  if (service?.vertical && service.vertical !== "alojamiento") return null;

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
    parts.push(
      `Hasta ${Math.floor(max)} huésped${max === 1 ? "" : "es"}`,
    );
  }
  if (hasInc) {
    parts.push(
      `incluye ${Math.floor(incluidos)}`,
    );
  }
  if (hasExtra) {
    const euro =
      Number.isInteger(extra) ? String(extra) : extra.toFixed(2).replace(/\.?0+$/, "");
    parts.push(`+${euro}€ por huésped adicional`);
  }

  return parts.join(" · ");
}
