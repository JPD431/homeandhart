/**
 * Modalidad de cobro (niñera / mascotas).
 * Distinto de services.modalidad (domicilio).
 *
 * NULL en BD = comportamiento legacy por vertical (ninos→hora, mascotas→dia).
 * El cálculo de reserva aún no usa estos campos (paso 2).
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
    hint: "El cliente reserva uno o varios días seguidos. Cobras €/día × días. Indica cuántas horas dura tu día (informativo).",
  },
  {
    value: "medio_dia",
    label: "Por medio día",
    hint: "El cliente reserva día(s) y hora de inicio. Cobras €/medio día × días. Indica cuántas horas es tu medio día (informativo).",
  },
];

/** Default implícito cuando modalidad_cobro es NULL (servicios existentes). */
export function defaultModalidadCobroForVertical(vertical) {
  if (vertical === "ninos") return "hora";
  if (vertical === "mascotas") return "dia";
  return null;
}

export function supportsModalidadCobro(vertical) {
  return vertical === "ninos" || vertical === "mascotas";
}

/**
 * Resuelve la modalidad efectiva para UI/info.
 * NULL en BD → default por vertical (retrocompat).
 */
export function resolveModalidadCobro(svcOrVertical, modalidadCobro) {
  const vertical =
    typeof svcOrVertical === "string"
      ? svcOrVertical
      : svcOrVertical?.vertical;
  const raw =
    modalidadCobro !== undefined
      ? modalidadCobro
      : typeof svcOrVertical === "object" && svcOrVertical
        ? svcOrVertical.modalidad_cobro
        : null;

  if (raw && MODALIDAD_COBRO_VALUES.includes(raw)) return raw;
  return defaultModalidadCobroForVertical(vertical);
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

/** Label del campo precio según modalidad (o vertical si no hay modalidad). */
export function getPrecioCobroLabel(vertical, modalidadCobro) {
  if (vertical === "alojamiento") return "¿Cuánto cobras por noche? (€)";
  const m = resolveModalidadCobro(vertical, modalidadCobro);
  if (m === "hora") return "¿Cuánto cobras por hora? (€)";
  if (m === "medio_dia") return "¿Cuánto cobras por medio día? (€)";
  if (m === "dia") return "¿Cuánto cobras por día? (€)";
  return "Precio (€)";
}

export function getHorasPorUnidadLabel(modalidad) {
  if (modalidad === "medio_dia") {
    return "¿Cuántas horas es un medio día?";
  }
  return "¿Cuántas horas es un día completo?";
}

export function getHorasPorUnidadHint(modalidad) {
  if (modalidad === "medio_dia") {
    return "Solo informativo para el cliente (ej. 4 o 5 horas). No cambia el precio: cobras por medio día.";
  }
  return "Solo informativo para el cliente (ej. 8 horas). No cambia el precio: cobras por día completo.";
}

/**
 * Parsea campos de modalidad desde fila BD → formulario.
 * Si NULL, rellena el default por vertical para que el selector no mienta.
 */
export function parseModalidadCobroFromDb(row) {
  const vertical = row?.vertical;
  if (!supportsModalidadCobro(vertical)) {
    return { modalidad_cobro: "", horas_por_unidad: "" };
  }
  const modalidad = resolveModalidadCobro(row);
  let horas =
    row?.horas_por_unidad != null && row.horas_por_unidad !== ""
      ? String(row.horas_por_unidad)
      : "";
  // Default informativo en formulario si eligen día/medio día sin valor aún
  if (!horas && modalidadCobroNeedsHoras(modalidad)) {
    horas = modalidad === "medio_dia" ? "5" : "8";
  }
  return {
    modalidad_cobro: modalidad,
    horas_por_unidad: horas,
  };
}

/**
 * Serializa para payload de services.
 * alojamiento → ambos null.
 * hora → horas_por_unidad null.
 */
export function serializeModalidadCobroForDb(details, vertical) {
  if (!supportsModalidadCobro(vertical)) {
    return { modalidad_cobro: null, horas_por_unidad: null };
  }

  const modalidad = resolveModalidadCobro(vertical, details?.modalidad_cobro);
  if (!modalidadCobroNeedsHoras(modalidad)) {
    return { modalidad_cobro: modalidad, horas_por_unidad: null };
  }

  const h = Number(details?.horas_por_unidad);
  return {
    modalidad_cobro: modalidad,
    horas_por_unidad: Number.isFinite(h) && h > 0 ? h : null,
  };
}

/**
 * Validación de formulario (wizard / editar-perfil).
 * @returns {string|null} mensaje de error o null si ok
 */
export function validateModalidadCobro(details, vertical) {
  if (!supportsModalidadCobro(vertical)) return null;

  const precio = Number(details?.precio);
  if (!Number.isFinite(precio) || precio <= 0) {
    return "El precio debe ser mayor que 0.";
  }

  const modalidad = resolveModalidadCobro(vertical, details?.modalidad_cobro);
  if (!MODALIDAD_COBRO_VALUES.includes(modalidad)) {
    return "Elige cómo cobras este servicio: por hora, por día o por medio día.";
  }

  if (modalidadCobroNeedsHoras(modalidad)) {
    const h = Number(details?.horas_por_unidad);
    if (!Number.isFinite(h) || h <= 0) {
      return modalidad === "medio_dia"
        ? "Indica cuántas horas es un medio día (mayor que 0)."
        : "Indica cuántas horas es un día completo (mayor que 0).";
    }
    if (h > 24) {
      return "Las horas por unidad no pueden superar 24.";
    }
  }

  return null;
}

/**
 * Texto informativo para el anuncio (no afecta reserva).
 * Ej.: "Por hora · 15€/h" | "Cobra por día completo · 90€/día · aprox. 8h"
 */
export function formatModalidadCobroAnuncio(service) {
  if (!service || !supportsModalidadCobro(service.vertical)) return null;

  const modalidad = resolveModalidadCobro(service);
  const precio = Number(service.precio);
  const precioStr = Number.isFinite(precio)
    ? `${precio % 1 === 0 ? precio : precio.toFixed(2)}€`
    : null;

  if (modalidad === "hora") {
    return precioStr ? `Por hora · ${precioStr}/h` : "Por hora";
  }

  if (modalidad === "medio_dia") {
    const parts = ["Cobra por medio día"];
    if (precioStr) parts.push(`${precioStr}/medio día`);
    const h = Number(service.horas_por_unidad);
    if (Number.isFinite(h) && h > 0) {
      parts.push(`aprox. ${h % 1 === 0 ? h : h}h`);
    }
    return parts.join(" · ");
  }

  // dia
  const parts = ["Cobra por día completo"];
  if (precioStr) parts.push(`${precioStr}/día`);
  const h = Number(service.horas_por_unidad);
  if (Number.isFinite(h) && h > 0) {
    parts.push(`aprox. ${h % 1 === 0 ? h : h}h`);
  }
  return parts.join(" · ");
}
