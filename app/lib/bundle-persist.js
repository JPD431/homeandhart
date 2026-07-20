/**
 * Paso 2d: persistencia del carrito en sessionStorage (bundle_state).
 * Sobrevive F5, ir a /buscar y volver (atrás / bfcache pageshow).
 */

export const BUNDLE_STATE_KEY = "bundle_state";

const BUNDLE_STATE_VERSION = 1;

/** Campos mínimos del servicio para restaurar UI/precio sin re-fetch completo. */
export function serializeCartServiceForPersist(service) {
  if (!service?.id) return null;
  const profile = service.profiles_public;
  const proveedor =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? {
          nombre: profile.nombre ?? null,
          apellido: profile.apellido ?? null,
        }
      : null;

  return {
    id: service.id,
    titulo: service.titulo ?? null,
    vertical: service.vertical ?? null,
    precio: service.precio ?? null,
    ciudad: service.ciudad ?? null,
    proveedor_id: service.proveedor_id ?? null,
    modalidad: service.modalidad ?? null,
    cancellation_policy: service.cancellation_policy ?? null,
    reserva_inmediata: service.reserva_inmediata ?? null,
    disponible: service.disponible ?? null,
    capacidad_maxima: service.capacidad_maxima ?? null,
    huespedes_incluidos: service.huespedes_incluidos ?? null,
    precio_huesped_extra: service.precio_huesped_extra ?? null,
    oferta_descuento: service.oferta_descuento ?? null,
    oferta_valida_hasta: service.oferta_valida_hasta ?? null,
    descuentos_duracion: service.descuentos_duracion ?? null,
    estancia_minima: service.estancia_minima ?? null,
    estancia_maxima: service.estancia_maxima ?? null,
    antelacion_minima: service.antelacion_minima ?? null,
    dias_disponibles: service.dias_disponibles ?? null,
    profiles_public: proveedor,
    modalidades: Array.isArray(service.modalidades) ? service.modalidades : [],
  };
}

export function serializeCartByServiceIdForPersist(cartByServiceId) {
  if (!cartByServiceId || typeof cartByServiceId !== "object") return {};
  const out = {};
  for (const [id, entry] of Object.entries(cartByServiceId)) {
    if (!entry || typeof entry !== "object") continue;
    const svc = serializeCartServiceForPersist(entry.service);
    if (!svc) continue;
    out[id] = {
      service: svc,
      fechaInicio: entry.fechaInicio ?? "",
      fechaFin: entry.fechaFin ?? "",
      hora: entry.hora ?? "",
      duracionHoras: entry.duracionHoras ?? "",
      modalidadCobro:
        entry.modalidadCobro !== undefined ? entry.modalidadCobro : null,
      numHuespedes:
        entry.numHuespedes !== undefined ? entry.numHuespedes : null,
    };
  }
  return out;
}

export function serializeBundleServicesForPersist(bundleServices) {
  if (!Array.isArray(bundleServices)) return [];
  return bundleServices
    .map((s) => serializeCartServiceForPersist(s))
    .filter(Boolean);
}

export function buildBundleStateSnapshot({
  origenServiceId,
  mainServiceId,
  bundleServices,
  cartByServiceId,
  fechaInicio,
  fechaFin,
  hora,
  duracionHoras,
  modalidadCobro,
  numHuespedes,
  mensaje,
  aceptaPolitica,
}) {
  const origen = origenServiceId || mainServiceId || null;
  return {
    version: BUNDLE_STATE_VERSION,
    savedAt: Date.now(),
    origenServiceId: origen,
    mainServiceId: mainServiceId || origen,
    bundleServices: serializeBundleServicesForPersist(bundleServices),
    cartByServiceId: serializeCartByServiceIdForPersist(cartByServiceId),
    fechaInicio: fechaInicio ?? "",
    fechaFin: fechaFin ?? "",
    hora: hora ?? "",
    duracionHoras: duracionHoras ?? "",
    modalidadCobro: modalidadCobro ?? null,
    numHuespedes: numHuespedes !== undefined ? numHuespedes : null,
    mensaje: mensaje ?? "",
    aceptaPolitica: aceptaPolitica === true,
  };
}

export function writeBundleStateToSession(snapshot) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(BUNDLE_STATE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("[bundle_state] write failed", err);
  }
}

export function readBundleStateFromSession() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUNDLE_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearBundleStateFromSession() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(BUNDLE_STATE_KEY);
  } catch {
    // ignore
  }
}

/**
 * ¿Aplica el snapshot guardado a esta página /reservar/[serviceId]?
 * origenServiceId = servicio principal del carrito (main).
 */
export function bundleStateAppliesToPage(state, pageServiceId) {
  if (!state || !pageServiceId) return false;
  const origen = state.origenServiceId || state.mainServiceId;
  return origen === pageServiceId;
}

export function applyBundleStateToReservarSetters(state, setters) {
  if (!state) return false;

  const {
    setFechaInicio,
    setFechaFin,
    setHora,
    setDuracionHoras,
    setModalidadCobro,
    setNumHuespedes,
    setMensaje,
    setAceptaPolitica,
    setBundleServices,
    setCartByServiceId,
    setMainServiceId,
    bundleDatesAppliedRef,
  } = setters;

  if (state.fechaInicio) {
    setFechaInicio(state.fechaInicio);
    if (bundleDatesAppliedRef) bundleDatesAppliedRef.current = true;
  }
  if (state.fechaFin) setFechaFin(state.fechaFin);
  if (state.hora) setHora(state.hora);
  if (state.duracionHoras) setDuracionHoras(state.duracionHoras);
  if (state.modalidadCobro !== undefined) {
    setModalidadCobro(state.modalidadCobro);
  }
  if (state.numHuespedes !== undefined) {
    setNumHuespedes(state.numHuespedes);
  }
  if (typeof state.mensaje === "string") setMensaje(state.mensaje);
  if (state.aceptaPolitica === true) setAceptaPolitica(true);

  if (Array.isArray(state.bundleServices)) {
    setBundleServices(state.bundleServices);
  }
  if (state.cartByServiceId && typeof state.cartByServiceId === "object") {
    setCartByServiceId(state.cartByServiceId);
  }
  if (state.mainServiceId) setMainServiceId(state.mainServiceId);

  return true;
}

export function restoreBundleStateFromSession(pageServiceId, setters) {
  const state = readBundleStateFromSession();
  if (!bundleStateAppliesToPage(state, pageServiceId)) return false;
  return applyBundleStateToReservarSetters(state, setters);
}

/** Debounced writer para no escribir en cada tecla. */
export function createBundleStatePersister(getSnapshot, delayMs = 400) {
  let timer = null;

  function persistNow() {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    writeBundleStateToSession(snapshot);
  }

  function schedulePersist() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      persistNow();
    }, delayMs);
  }

  function flushPersist() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    persistNow();
  }

  function dispose() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { schedulePersist, flushPersist, dispose };
}
