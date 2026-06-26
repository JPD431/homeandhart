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

export function getCapacidadPersonas(service) {
  const fromJson = service?.capacidad?.personas;
  if (fromJson != null && fromJson !== "") {
    return Number(fromJson);
  }
  return null;
}
