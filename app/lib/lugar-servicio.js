/**
 * Dónde se presta el servicio (bookings.lugar_servicio).
 * Distinto de services.modalidad (oferta del proveedor) y de modalidad_cobro (hora/día).
 *
 * Valores en bookings: 'casa_proveedor' | 'casa_cliente' | null
 * Valores en services.modalidad: domicilio_proveedor | domicilio_cliente | ambas | paseos | todo_incluido
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
 * Lugar efectivo automático desde services.modalidad (sin selector).
 * - domicilio_proveedor → casa_proveedor
 * - domicilio_cliente → casa_cliente
 * - ambas → null (hay que elegir)
 * - paseos / todo_incluido / alojamiento / desconocido → null
 *
 * @param {string | null | undefined} modalidadServicio
 * @returns {'casa_proveedor' | 'casa_cliente' | null}
 */
export function resolveLugarServicioFromModalidad(modalidadServicio) {
  if (modalidadServicio === "domicilio_proveedor") return LUGAR_CASA_PROVEEDOR;
  if (modalidadServicio === "domicilio_cliente") return LUGAR_CASA_CLIENTE;
  return null;
}

/**
 * Valor inicial al cargar un servicio en el carrito/reserva.
 * Si es 'ambas', null hasta que el cliente elija.
 */
export function initialLugarServicio(modalidadServicio) {
  if (needsLugarSelector(modalidadServicio)) return null;
  return resolveLugarServicioFromModalidad(modalidadServicio);
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
    return "El servicio es en el domicilio del proveedor";
  }
  if (lugarServicio === LUGAR_CASA_CLIENTE) {
    return "El servicio es en tu domicilio";
  }
  if (modalidadServicio === "paseos") {
    return "Modalidad: paseos (el lugar se coordina con el proveedor)";
  }
  if (modalidadServicio === "todo_incluido") {
    return "Modalidad: todo incluido (el lugar se coordina con el proveedor)";
  }
  return null;
}

/**
 * Lugar efectivo server-side: NO confiar en el body del cliente salvo modalidad='ambas'.
 *
 * Reglas:
 * - domicilio_proveedor → siempre casa_proveedor (ignora body; sin dirección cliente)
 * - domicilio_cliente → siempre casa_cliente (ignora body de lugar; dirección/a_definir sí)
 * - ambas → respeta elección del cliente si es casa_*; si basura/null → casa_proveedor
 * - paseos / todo_incluido / null / otras → lugar null (ignora body; sin dirección cliente)
 *
 * La dirección del cliente SOLO se guarda si el lugar EFECTIVO es casa_cliente.
 *
 * @param {{
 *   lugar_servicio?: string | null,
 *   direccion_cliente?: string | null,
 *   direccion_cliente_a_definir?: boolean | null,
 * }} raw
 * @param {string | null | undefined} modalidadServicio — services.modalidad real
 */
export function normalizeLugarPayloadForBooking(raw = {}, modalidadServicio = null) {
  const modalidad = modalidadServicio || null;
  const rawLugar = raw.lugar_servicio ?? null;
  const clientChoseValid =
    rawLugar === LUGAR_CASA_PROVEEDOR || rawLugar === LUGAR_CASA_CLIENTE;

  let lugar = null;

  if (modalidad === "domicilio_proveedor") {
    // Forzar: el cliente no puede pedir casa_cliente.
    lugar = LUGAR_CASA_PROVEEDOR;
  } else if (modalidad === "domicilio_cliente") {
    // Forzar: el cliente no puede pedir casa_proveedor.
    lugar = LUGAR_CASA_CLIENTE;
  } else if (modalidad === "ambas") {
    // Único caso donde se respeta la elección del cliente.
    lugar = clientChoseValid ? rawLugar : LUGAR_CASA_PROVEEDOR;
  } else {
    // paseos, todo_incluido, alojamiento (modalidad null), desconocido
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
  // Legacy / alojamiento / paseos: misma regla que emails (needsDireccionFields)
  return needsDireccionFields(vertical, modalidad);
}

/**
 * ¿Mostrar datos de contacto del cliente al proveedor?
 * (Alineado a canShowProviderContact — el caller debe filtrar por estado.)
 */
export function shouldShowClienteDireccionToProvider(lugarServicio) {
  return lugarServicio === LUGAR_CASA_CLIENTE;
}
