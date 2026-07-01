export const DEFAULT_CAPACIDAD_ALOJAMIENTO = {
  personas: 2,
  habitaciones: 1,
  camas: 1,
  banos: 1,
};

function clampCapacidadValue(value, min = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.floor(num));
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
  { key: "personas", label: "Personas", icon: "👥" },
  { key: "habitaciones", label: "Habitaciones", icon: "🛏️" },
  { key: "camas", label: "Camas", icon: "🛌" },
  { key: "banos", label: "Baños", icon: "🚿" },
];

/** Filas { icon, label, value } para la ficha; vacío si no hay capacidad. */
export function getCapacidadDisplayRows(service) {
  const cap = getCapacidadForDisplay(service);
  if (!cap) return [];

  return CAPACIDAD_DISPLAY_ITEMS.map(({ key, label, icon }) => {
    const value = cap[key];
    if (value == null || value === "") return null;
    return { icon, label, value };
  }).filter(Boolean);
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
