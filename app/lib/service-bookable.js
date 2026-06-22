export const SERVICE_UNAVAILABLE_MSG =
  "Este servicio no está disponible en este momento";

export const COBROS_INACTIVE_MSG =
  "Este proveedor todavía no puede recibir pagos. Inténtalo más tarde.";

/** Une profiles_public y profiles!proveedor_id del mismo servicio. */
export function getProveedorFromService(service) {
  if (!service) return null;
  const pub = service.profiles_public;
  const prov = service.profiles;
  if (!pub && !prov) return null;
  return {
    ...pub,
    ...prov,
    verificado: pub?.verificado ?? prov?.verificado,
    cobros_activos: prov?.cobros_activos ?? pub?.cobros_activos,
  };
}

export function isServiceBookable(service) {
  const proveedor = getProveedorFromService(service);
  return (
    service?.disponible === true &&
    proveedor?.verificado === true &&
    proveedor?.cobros_activos === true
  );
}

export function getServiceBookabilityIssue(service) {
  if (!service || service.disponible !== true) {
    return SERVICE_UNAVAILABLE_MSG;
  }
  const proveedor = getProveedorFromService(service);
  if (proveedor?.verificado !== true) {
    return SERVICE_UNAVAILABLE_MSG;
  }
  if (proveedor?.cobros_activos !== true) {
    return COBROS_INACTIVE_MSG;
  }
  return null;
}
