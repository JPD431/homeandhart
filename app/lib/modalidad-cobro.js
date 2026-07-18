/**
 * Modalidades de cobro MÚLTIPLES (niñera / mascotas).
 * Distinto de services.modalidad (domicilio).
 *
 * Sin filas en service_modalidades = legacy:
 *   ninos → hora con services.precio
 *   mascotas → dia con services.precio
 *
 * Paso 2: calculateServiceBasePrice usa las filas cuando existen.
 */

export const MODALIDAD_COBRO_VALUES = ["hora", "dia", "medio_dia"];

export const MODALIDAD_COBRO_OPTIONS = [
  {
    value: "hora",
    label: "Por hora",
    hint: "El cliente elige fecha, hora de inicio y cuántas horas. Cobras €/hora × horas.",
  },
  {
    value: "dia",
    label: "Por día completo",
    hint: "El cliente reserva uno o varios días. Cobras €/día × días.",
  },
  {
    value: "medio_dia",
    label: "Por medio día",
    hint: "El cliente reserva día(s) y hora de inicio. Cobras €/medio día × días.",
  },
];

export function supportsModalidadCobro(vertical) {
  return vertical === "ninos" || vertical === "mascotas";
}

/** Modalidad que hoy usa la reserva (hasta el paso 2). */
export function legacyModalidadForVertical(vertical) {
  if (vertical === "ninos") return "hora";
  if (vertical === "mascotas") return "dia";
  return null;
}

export function modalidadCobroNeedsHoras(modalidad) {
  return modalidad === "dia" || modalidad === "medio_dia";
}

export function getModalidadCobroPriceUnit(modalidad) {
  if (modalidad === "hora") return "hora";
  if (modalidad === "medio_dia") return "medio día";
  if (modalidad === "dia") return "día";
  return "día";
}

export function getModalidadCobroPriceSuffix(modalidad) {
  if (modalidad === "hora") return "/ hora";
  if (modalidad === "medio_dia") return "/ medio día";
  if (modalidad === "dia") return "/ día";
  return "";
}

export function getPrecioCobroLabel(modalidad) {
  if (modalidad === "hora") return "Precio por hora (€)";
  if (modalidad === "medio_dia") return "Precio por medio día (€)";
  if (modalidad === "dia") return "Precio por día (€)";
  return "Precio (€)";
}

export function getHorasPorUnidadLabel(modalidad) {
  if (modalidad === "medio_dia") return "¿Cuántas horas es un medio día?";
  return "¿Cuántas horas es un día completo?";
}

export function getSuplementoLabel(vertical, modalidad) {
  const who = vertical === "mascotas" ? "mascota" : "niño";
  const unit = getModalidadCobroPriceUnit(modalidad);
  return `Suplemento por ${who} adicional (€/${unit})`;
}

function emptySlot(modalidad) {
  return {
    activa: false,
    precio: "",
    horas_unidad:
      modalidad === "medio_dia" ? "5" : modalidad === "dia" ? "8" : "",
    suplemento_extra: "",
  };
}

/** Formulario vacío (3 slots). */
export function emptyModalidadesCobroForm() {
  return {
    hora: emptySlot("hora"),
    dia: emptySlot("dia"),
    medio_dia: emptySlot("medio_dia"),
  };
}

/**
 * Semilla legacy cuando no hay filas: activa la modalidad actual del vertical
 * con services.precio (+ suplemento global si existe).
 */
export function seedModalidadesCobroFromLegacy(vertical, rowOrDetails = {}) {
  const form = emptyModalidadesCobroForm();
  if (!supportsModalidadCobro(vertical)) return form;

  const legacy = legacyModalidadForVertical(vertical);
  const precio =
    rowOrDetails.precio != null && rowOrDetails.precio !== ""
      ? String(rowOrDetails.precio)
      : "";
  const supl =
    rowOrDetails.precio_huesped_extra != null &&
    rowOrDetails.precio_huesped_extra !== ""
      ? String(rowOrDetails.precio_huesped_extra)
      : "";

  form[legacy] = {
    ...form[legacy],
    activa: true,
    precio,
    suplemento_extra: supl,
  };
  return form;
}

/**
 * Filas BD → formulario. Si no hay filas, semilla legacy.
 */
export function parseModalidadesCobroFromRows(vertical, rows, legacyRow = {}) {
  if (!supportsModalidadCobro(vertical)) {
    return { modalidades_cobro: emptyModalidadesCobroForm() };
  }

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return {
      modalidades_cobro: seedModalidadesCobroFromLegacy(vertical, legacyRow),
    };
  }

  const form = emptyModalidadesCobroForm();
  for (const row of list) {
    const m = row?.modalidad;
    if (!MODALIDAD_COBRO_VALUES.includes(m)) continue;
    form[m] = {
      activa: true,
      precio: row.precio != null ? String(row.precio) : "",
      horas_unidad:
        row.horas_unidad != null && row.horas_unidad !== ""
          ? String(row.horas_unidad)
          : m === "medio_dia"
            ? "5"
            : m === "dia"
              ? "8"
              : "",
      suplemento_extra:
        row.suplemento_extra != null && row.suplemento_extra !== ""
          ? String(row.suplemento_extra)
          : "",
    };
  }
  return { modalidades_cobro: form };
}

/**
 * Formulario → filas para persistir (solo activas).
 * @returns {{ ok: true, rows: object[] } | { ok: false, error: string }}
 */
export function serializeModalidadesCobroRows(details, vertical) {
  if (!supportsModalidadCobro(vertical)) {
    return { ok: true, rows: [] };
  }

  const form = details?.modalidades_cobro || emptyModalidadesCobroForm();
  const rows = [];

  for (const modalidad of MODALIDAD_COBRO_VALUES) {
    const slot = form[modalidad];
    if (!slot?.activa) continue;

    const precio = Number(slot.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      return {
        ok: false,
        error: `Indica un precio mayor que 0 para «${labelModalidad(modalidad)}».`,
      };
    }

    let horas_unidad = null;
    if (modalidadCobroNeedsHoras(modalidad)) {
      const h = Number(slot.horas_unidad);
      if (!Number.isFinite(h) || h <= 0) {
        return {
          ok: false,
          error:
            modalidad === "medio_dia"
              ? "Indica cuántas horas es un medio día (mayor que 0)."
              : "Indica cuántas horas es un día completo (mayor que 0).",
        };
      }
      if (h > 24) {
        return { ok: false, error: "Las horas no pueden superar 24." };
      }
      horas_unidad = h;
    }

    let suplemento_extra = null;
    if (slot.suplemento_extra != null && slot.suplemento_extra !== "") {
      const s = Number(slot.suplemento_extra);
      if (!Number.isFinite(s) || s < 0) {
        return {
          ok: false,
          error: `El suplemento de «${labelModalidad(modalidad)}» no puede ser negativo.`,
        };
      }
      if (s > 0) suplemento_extra = s;
    }

    rows.push({ modalidad, precio, horas_unidad, suplemento_extra });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: "Activa al menos una modalidad de cobro (hora, día o medio día).",
    };
  }

  return { ok: true, rows };
}

function labelModalidad(modalidad) {
  return (
    MODALIDAD_COBRO_OPTIONS.find((o) => o.value === modalidad)?.label ||
    modalidad
  );
}

/**
 * Validación de formulario.
 * @returns {string|null}
 */
export function validateModalidadCobro(details, vertical) {
  if (!supportsModalidadCobro(vertical)) return null;
  const result = serializeModalidadesCobroRows(details, vertical);
  return result.ok ? null : result.error;
}

/**
 * Precio a guardar en services.precio (reserva actual):
 * preferir modalidad legacy si está activa; si no, no tocar (caller usa details.precio).
 */
export function getSyncedServicesPrecio(details, vertical) {
  if (!supportsModalidadCobro(vertical)) {
    const p = Number(details?.precio);
    return Number.isFinite(p) && p > 0 ? p : null;
  }
  const form = details?.modalidades_cobro;
  const legacy = legacyModalidadForVertical(vertical);
  const slot = form?.[legacy];
  if (slot?.activa) {
    const p = Number(slot.precio);
    if (Number.isFinite(p) && p > 0) return p;
  }
  const p = Number(details?.precio);
  return Number.isFinite(p) && p > 0 ? p : null;
}

/** Filas o legacy → texto anuncio. */
export function formatModalidadesCobroAnuncio(service, rows) {
  if (!service || !supportsModalidadCobro(service.vertical)) return null;

  const list = Array.isArray(rows)
    ? rows
    : Array.isArray(service.modalidades)
      ? service.modalidades
      : [];

  if (list.length > 0) {
    const parts = [];
    for (const modalidad of MODALIDAD_COBRO_VALUES) {
      const row = list.find((r) => r.modalidad === modalidad);
      if (!row) continue;
      const precio = Number(row.precio);
      if (!Number.isFinite(precio) || precio <= 0) continue;
      const precioStr =
        precio % 1 === 0 ? String(precio) : precio.toFixed(2).replace(/\.?0+$/, "");
      if (modalidad === "hora") parts.push(`Por hora ${precioStr}€`);
      else if (modalidad === "dia") parts.push(`Por día ${precioStr}€`);
      else parts.push(`Medio día ${precioStr}€`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  // Legacy sin filas
  const legacy = legacyModalidadForVertical(service.vertical);
  const precio = Number(service.precio);
  if (!Number.isFinite(precio)) {
    return legacy === "hora" ? "Por hora" : "Por día";
  }
  const precioStr =
    precio % 1 === 0 ? String(precio) : precio.toFixed(2).replace(/\.?0+$/, "");
  return legacy === "hora"
    ? `Por hora ${precioStr}€`
    : `Por día ${precioStr}€`;
}

/** @deprecated alias */
export const formatModalidadCobroAnuncio = formatModalidadesCobroAnuncio;

/**
 * Sufijo de precio en panel: modalidad legacy (comportamiento actual de reserva).
 */
export function resolveDisplayPriceSuffix(service) {
  const legacy = legacyModalidadForVertical(service?.vertical);
  if (!legacy) return "";
  return getModalidadCobroPriceSuffix(legacy);
}
