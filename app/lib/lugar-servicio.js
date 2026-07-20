/**
 * Dónde se presta el servicio (bookings.lugar_servicio).
 * Distinto de services.modalidad (oferta del proveedor) y de modalidad_cobro (hora/día).
 *
 * Valores en bookings: 'casa_proveedor' | 'casa_cliente' | null
 * Valores en services.modalidad: domicilio_proveedor | domicilio_cliente | ambas | paseos | todo_incluido
 *
 * Mapeo impuesto (salvo 'ambas'):
 *   domicilio_proveedor / todo_incluido / alojamiento → casa_proveedor
 *   domicilio_cliente / paseos                         → casa_cliente
 *   ambas → elige el cliente
 */

import { needsDireccionFields } from "@/app/lib/service-payload";

export const LUGAR_CASA_PROVEEDOR = "casa_proveedor";
export const LUGAR_CASA_CLIENTE = "casa_cliente";

/**
 * ¿El cliente debe elegir dónde? Solo si el proveedor ofrece ambas.
 * @param {string | null | undefined} modalidadServicio
 */
export function needsLugarSelector(modalidadServicio) {
  return modalidadServicio === "ambas";
}

/**
 * Lugar efectivo automático desde services.modalidad (+ vertical alojamiento).
 * - domicilio_proveedor / todo_incluido / alojamiento → casa_proveedor
 * - domicilio_cliente / paseos → casa_cliente
 * - ambas → null (hay que elegir)
 *
 * @param {string | null | undefined} modalidadServicio
 * @param {string | null | undefined} [vertical]
 * @returns {'casa_proveedor' | 'casa_cliente' | null}
 */
export function resolveLugarServicioFromModalidad(
  modalidadServicio,
  vertical = null,
) {
  if (vertical === "alojamiento") return LUGAR_CASA_PROVEEDOR;
  if (
    modalidadServicio === "domicilio_proveedor" ||
    modalidadServicio === "todo_incluido"
  ) {
    return LUGAR_CASA_PROVEEDOR;
  }
  if (
    modalidadServicio === "domicilio_cliente" ||
    modalidadServicio === "paseos"
  ) {
    return LUGAR_CASA_CLIENTE;
  }
  return null;
}

/**
 * Valor inicial al cargar un servicio en el carrito/reserva.
 * Si es 'ambas', null hasta que el cliente elija.
 */
export function initialLugarServicio(modalidadServicio, vertical = null) {
  if (needsLugarSelector(modalidadServicio)) return null;
  return resolveLugarServicioFromModalidad(modalidadServicio, vertical);
}

/**
 * ¿Mostrar bloque de dirección del cliente (opcional / a definir)?
 * @param {string | null | undefined} lugarServicio
 */
export function needsClienteDireccionBlock(lugarServicio) {
  return lugarServicio === LUGAR_CASA_CLIENTE;
}

/**
 * Texto informativo cuando el lugar ya está fijado (sin selector).
 * @param {string | null | undefined} lugarServicio
 * @param {string | null | undefined} modalidadServicio
 */
export function lugarServicioInfoLabel(lugarServicio, modalidadServicio) {
  if (lugarServicio === LUGAR_CASA_PROVEEDOR) {
    if (modalidadServicio === "todo_incluido") {
      return "La mascota se queda en casa del profesional";
    }
    return "El servicio es en casa del profesional";
  }
  if (lugarServicio === LUGAR_CASA_CLIENTE) {
    if (modalidadServicio === "paseos") {
      return "El profesional recoge la mascota en tu casa";
    }
    return "El servicio es en tu casa";
  }
  return null;
}

/**
 * Lugar efectivo server-side: NO confiar en el body del cliente salvo modalidad='ambas'.
 *
 * Reglas:
 * - alojamiento / domicilio_proveedor / todo_incluido → casa_proveedor (ignora body)
 * - domicilio_cliente / paseos → casa_cliente (ignora body de lugar; dirección/a_definir sí)
 * - ambas → respeta elección del cliente si es casa_*; si basura/null → casa_proveedor
 * - otras → null
 *
 * La dirección del cliente SOLO se guarda si el lugar EFECTIVO es casa_cliente.
 *
 * @param {{
 *   lugar_servicio?: string | null,
 *   direccion_cliente?: string | null,
 *   direccion_cliente_a_definir?: boolean | null,
 * }} raw
 * @param {string | null | undefined} modalidadServicio — services.modalidad real
 * @param {string | null | undefined} [vertical] — services.vertical (alojamiento)
 */
export function normalizeLugarPayloadForBooking(
  raw = {},
  modalidadServicio = null,
  vertical = null,
) {
  const modalidad = modalidadServicio || null;
  const rawLugar = raw.lugar_servicio ?? null;
  const clientChoseValid =
    rawLugar === LUGAR_CASA_PROVEEDOR || rawLugar === LUGAR_CASA_CLIENTE;

  let lugar = null;

  if (vertical === "alojamiento") {
    lugar = LUGAR_CASA_PROVEEDOR;
  } else if (
    modalidad === "domicilio_proveedor" ||
    modalidad === "todo_incluido"
  ) {
    lugar = LUGAR_CASA_PROVEEDOR;
  } else if (modalidad === "domicilio_cliente" || modalidad === "paseos") {
    lugar = LUGAR_CASA_CLIENTE;
  } else if (modalidad === "ambas") {
    // Único caso donde se respeta la elección del cliente.
    lugar = clientChoseValid ? rawLugar : LUGAR_CASA_PROVEEDOR;
  } else {
    lugar = null;
  }

  if (lugar !== LUGAR_CASA_CLIENTE) {
    return {
      lugar_servicio: lugar,
      direccion_cliente_a_definir: null,
      direccion_cliente: null,
    };
  }

  const direccion =
    typeof raw.direccion_cliente === "string"
      ? raw.direccion_cliente.trim() || null
      : null;

  // Explícito a_definir, o vacío → a definir (no bloquear).
  const aDefinirExplicit = raw.direccion_cliente_a_definir === true;
  const aDefinir = aDefinirExplicit || !direccion;

  return {
    lugar_servicio: LUGAR_CASA_CLIENTE,
    direccion_cliente_a_definir: aDefinir,
    direccion_cliente: aDefinir ? null : direccion,
  };
}

/**
 * ¿Mostrar dirección del proveedor al cliente tras confirmar?
 * @param {{
 *   lugarServicio?: string | null,
 *   vertical?: string | null,
 *   modalidad?: string | null,
 * }} opts
 */
export function shouldShowProviderDireccion({
  lugarServicio = null,
  vertical = null,
  modalidad = null,
} = {}) {
  if (lugarServicio === LUGAR_CASA_PROVEEDOR) return true;
  if (lugarServicio === LUGAR_CASA_CLIENTE) return false;
  // Legacy (lugar null): inferir con needsDireccionFields (incl. todo_incluido)
  return needsDireccionFields(vertical, modalidad);
}

/**
 * ¿Mostrar dirección del cliente al proveedor?
 * @param {string | null | undefined} lugarServicio
 * @param {string | null | undefined} [modalidad] — fallback legacy si lugar null
 */
export function shouldShowClienteDireccionToProvider(
  lugarServicio,
  modalidad = null,
) {
  if (lugarServicio === LUGAR_CASA_CLIENTE) return true;
  if (lugarServicio === LUGAR_CASA_PROVEEDOR) return false;
  // Legacy: inferir desde modalidad del servicio
  return modalidad === "paseos" || modalidad === "domicilio_cliente";
}
