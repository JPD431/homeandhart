/** Claves estables de pasos del wizard de proveedor. */
export const STEP_KEY = {
  PERFIL: "perfil",
  VERTICALES: "verticales",
  SERVICIO_ALOJAMIENTO: "servicio-alojamiento",
  SERVICIO_NINOS: "servicio-ninos",
  SERVICIO_MASCOTAS: "servicio-mascotas",
  DOCUMENTOS: "documentos",
  PREVIEW: "preview",
  RESUMEN: "resumen",
  CONFIRMACION: "confirmacion",
};

export { VERTICAL_COLORS } from "@/app/lib/provider-verticals";

/** Orden legacy (Fase 1): 1=verticales, 2=perfil, 3-5=servicios, 6=docs, 7=revisión, 8=confirmación. */
const LEGACY_NUMERIC_TO_KEY = {
  1: STEP_KEY.VERTICALES,
  2: STEP_KEY.PERFIL,
  3: STEP_KEY.SERVICIO_ALOJAMIENTO,
  4: STEP_KEY.SERVICIO_NINOS,
  5: STEP_KEY.SERVICIO_MASCOTAS,
  6: STEP_KEY.DOCUMENTOS,
  7: STEP_KEY.RESUMEN,
  8: STEP_KEY.CONFIRMACION,
};

/** Alias de keys antiguas en getVisibleSteps (Fase 1). */
const LEGACY_KEY_ALIASES = {
  servicios: STEP_KEY.VERTICALES,
  alojamiento: STEP_KEY.SERVICIO_ALOJAMIENTO,
  ninos: STEP_KEY.SERVICIO_NINOS,
  mascotas: STEP_KEY.SERVICIO_MASCOTAS,
  revision: STEP_KEY.RESUMEN,
};

const ALL_STEP_KEYS = new Set(Object.values(STEP_KEY));

/**
 * Pasos visibles en el wizard (sin confirmación final).
 * Orden Fase 2: perfil → verticales → servicios → documentos → preview → resumen.
 */
export function buildVisibleSteps(verticales = []) {
  const steps = [
    { key: STEP_KEY.PERFIL, label: "Quién eres", vertical: null },
    { key: STEP_KEY.VERTICALES, label: "Qué ofreces", vertical: null },
  ];

  if (verticales.includes("alojamiento")) {
    steps.push({
      key: STEP_KEY.SERVICIO_ALOJAMIENTO,
      label: "Alojamiento",
      vertical: "alojamiento",
    });
  }
  if (verticales.includes("ninos")) {
    steps.push({
      key: STEP_KEY.SERVICIO_NINOS,
      label: "Niñera",
      vertical: "ninos",
    });
  }
  if (verticales.includes("mascotas")) {
    steps.push({
      key: STEP_KEY.SERVICIO_MASCOTAS,
      label: "Mascotas",
      vertical: "mascotas",
    });
  }

  steps.push(
    { key: STEP_KEY.DOCUMENTOS, label: "Tus documentos", vertical: null },
    { key: STEP_KEY.PREVIEW, label: "Vista previa", vertical: null },
    { key: STEP_KEY.RESUMEN, label: "Última revisión", vertical: null },
  );

  return steps;
}

/** Pasos que cuentan en la barra de progreso (hasta antes de preview). */
export function getProgressSteps(verticales = []) {
  return buildVisibleSteps(verticales).filter(
    (s) => s.key !== STEP_KEY.PREVIEW && s.key !== STEP_KEY.RESUMEN,
  );
}

export function getStepByKey(steps, key) {
  return steps.find((s) => s.key === key) ?? null;
}

export function getVerticalForServiceStep(stepKey) {
  if (stepKey === STEP_KEY.SERVICIO_ALOJAMIENTO) return "alojamiento";
  if (stepKey === STEP_KEY.SERVICIO_NINOS) return "ninos";
  if (stepKey === STEP_KEY.SERVICIO_MASCOTAS) return "mascotas";
  return null;
}

function stepVisibleForVerticales(stepKey, verticales) {
  const vertical = getVerticalForServiceStep(stepKey);
  if (!vertical) return true;
  return verticales.includes(vertical);
}

/**
 * Si el paso guardado no aplica (p. ej. servicio no elegido), devuelve el anterior visible.
 */
function resolveStepForVerticales(stepKey, verticales) {
  if (stepKey === STEP_KEY.CONFIRMACION) return STEP_KEY.CONFIRMACION;

  const visible = buildVisibleSteps(verticales);
  if (visible.some((s) => s.key === stepKey)) return stepKey;

  const order = [
    STEP_KEY.PERFIL,
    STEP_KEY.VERTICALES,
    STEP_KEY.SERVICIO_ALOJAMIENTO,
    STEP_KEY.SERVICIO_NINOS,
    STEP_KEY.SERVICIO_MASCOTAS,
    STEP_KEY.DOCUMENTOS,
    STEP_KEY.PREVIEW,
    STEP_KEY.RESUMEN,
    STEP_KEY.CONFIRMACION,
  ];

  const targetIdx = order.indexOf(stepKey);
  if (targetIdx === -1) return visible[0]?.key ?? STEP_KEY.PERFIL;

  for (let i = targetIdx; i >= 0; i--) {
    const k = order[i];
    if (k === STEP_KEY.CONFIRMACION) continue;
    if (visible.some((s) => s.key === k)) return k;
  }

  return visible[0]?.key ?? STEP_KEY.PERFIL;
}

/**
 * Convierte onboarding_step de BD (número legacy o key) a key estable.
 */
export function migrateLegacyOnboardingStep(stored, verticales = []) {
  if (!stored) return STEP_KEY.PERFIL;

  const trimmed = String(stored).trim();

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    const legacyKey = LEGACY_NUMERIC_TO_KEY[num];
    if (legacyKey) {
      return resolveStepForVerticales(legacyKey, verticales);
    }
  }

  if (LEGACY_KEY_ALIASES[trimmed]) {
    return resolveStepForVerticales(LEGACY_KEY_ALIASES[trimmed], verticales);
  }

  if (ALL_STEP_KEYS.has(trimmed)) {
    return resolveStepForVerticales(trimmed, verticales);
  }

  return STEP_KEY.PERFIL;
}

export function getProgressPosition(currentKey, verticales = []) {
  const progressSteps = getProgressSteps(verticales);
  const idx = progressSteps.findIndex((s) => s.key === currentKey);
  if (idx >= 0) {
    return { current: idx + 1, total: progressSteps.length };
  }
  return { current: progressSteps.length, total: progressSteps.length };
}

export function getStepIndex(steps, key) {
  return steps.findIndex((s) => s.key === key);
}
