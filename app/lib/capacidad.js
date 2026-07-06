export const BANO_TIPO_PRIVADO = "privado";
export const BANO_TIPO_COMPARTIDO = "compartido";

export const DEFAULT_CAPACIDAD_ALOJAMIENTO = {
  personas: 2,
  habitaciones: 1,
  camas: 1,
  banos: 1,
  bano_tipo: null,
};

function clampCapacidadValue(value, min = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.floor(num));
}

function normalizeBanoTipo(value) {
  if (value === BANO_TIPO_PRIVADO || value === BANO_TIPO_COMPARTIDO) {
    return value;
  }
  return null;
}

export function serializeCapacidad(details, vertical) {
  if (vertical !== "alojamiento") return null;

  const cap = details?.capacidad ?? {};
  return {
    personas: clampCapacidadValue(
      cap.personas ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.personas,
    ),
    habitaciones: clampCapacidadValue(
      cap.habitaciones ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.habitaciones,
    ),
    camas: clampCapacidadValue(cap.camas ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.camas),
    banos: clampCapacidadValue(cap.banos ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.banos),
    bano_tipo: normalizeBanoTipo(cap.bano_tipo),
  };
}

export function parseCapacidadFromDb(row) {
  const cap = row?.capacidad;
  if (!cap || typeof cap !== "object") {
    return { ...DEFAULT_CAPACIDAD_ALOJAMIENTO };
  }

  return {
    personas: clampCapacidadValue(
      cap.personas ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.personas,
    ),
    habitaciones: clampCapacidadValue(
      cap.habitaciones ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.habitaciones,
    ),
    camas: clampCapacidadValue(cap.camas ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.camas),
    banos: clampCapacidadValue(cap.banos ?? DEFAULT_CAPACIDAD_ALOJAMIENTO.banos),
    bano_tipo: normalizeBanoTipo(cap.bano_tipo),
  };
}

function readCapacidadObject(service) {
  let capData = service?.capacidad;
  if (capData == null || capData === "") return null;
  if (typeof capData === "string") {
    try {
      capData = JSON.parse(capData);
    } catch {
      return null;
    }
  }
  if (typeof capData !== "object" || capData === null || Array.isArray(capData)) {
    return null;
  }
  return capData;
}

export function getCapacidadPersonas(service) {
  const capData = readCapacidadObject(service);
  if (!capData) return null;

  const fromJson = capData.personas;
  if (fromJson == null || fromJson === "") return null;

  const n = Number(fromJson);
  return Number.isFinite(n) ? n : null;
}

/** Capacidad para mostrar al cliente; null si no hay dato en BD. */
export function getCapacidadForDisplay(service) {
  const capData = readCapacidadObject(service);
  if (!capData) return null;
  return parseCapacidadFromDb(service);
}

const CAPACIDAD_DISPLAY_ITEMS = [
  { key: "personas", singular: "persona", plural: "personas", icon: "👥" },
  { key: "habitaciones", singular: "habitación", plural: "habitaciones", icon: "🛏️" },
  { key: "camas", singular: "cama", plural: "camas", icon: "🛌" },
  { key: "banos", singular: "baño", plural: "baños", icon: "🚿" },
];

const BANO_TIPO_DISPLAY = {
  [BANO_TIPO_PRIVADO]: { icon: "🔒", label: "Baño", value: "Privado", banoTipo: true },
  [BANO_TIPO_COMPARTIDO]: { icon: "🚿", label: "Baño", value: "Compartido", banoTipo: true },
};

/**
 * Etiqueta con número + singular/plural correcto.
 * @param {number|string} count
 * @param {string} singular — p. ej. "habitación"
 * @param {string} plural — p. ej. "habitaciones"
 */
export function formatCountLabel(count, singular, plural) {
  const n = Number(count);
  const safe = Number.isFinite(n) ? Math.floor(n) : 0;
  const word = safe === 1 ? singular : plural;
  return `${safe} ${word}`;
}

/** Texto legible de una fila de capacidad (anuncio / ficha). */
export function formatCapacidadDisplayRow(row) {
  if (row?.banoTipo) {
    return `${row.label} ${String(row.value).toLowerCase()}`;
  }
  return formatCountLabel(row.value, row.singular, row.plural);
}

/** Filas { icon, label, value, singular, plural } para la ficha; vacío si no hay capacidad. */
export function getCapacidadDisplayRows(service) {
  const cap = getCapacidadForDisplay(service);
  if (!cap) return [];

  const rows = CAPACIDAD_DISPLAY_ITEMS.map(({ key, singular, plural, icon }) => {
    const value = cap[key];
    if (value == null || value === "") return null;
    return { icon, label: plural, singular, plural, value };
  }).filter(Boolean);

  if (cap.bano_tipo && BANO_TIPO_DISPLAY[cap.bano_tipo]) {
    rows.push(BANO_TIPO_DISPLAY[cap.bano_tipo]);
  }

  return rows;
}

/** true si el servicio cumple el mínimo de personas (o no aplica / sin dato). */
export function serviceMeetsCapacidadMin(service, capacidadMin) {
  const min = Number(capacidadMin);
  if (!Number.isFinite(min) || min <= 1 || service?.vertical !== "alojamiento") {
    return true;
  }

  const cap = getCapacidadPersonas(service);
  if (cap === null) return true;

  return cap >= min;
}
