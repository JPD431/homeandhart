export const SERVICE_UNAVAILABLE_MSG =
  "Este servicio no está disponible en este momento";

export const COBROS_INACTIVE_MSG =
  "Este proveedor todavía no puede recibir pagos. Inténtalo más tarde.";

/** Datos del proveedor desde profiles_public (y opcionalmente profiles en servidor). */
function unwrapProfileEmbed(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function getProveedorFromService(service) {
  if (!service) return null;
  const pub = unwrapProfileEmbed(service.profiles_public);
  const prov = unwrapProfileEmbed(service.profiles);
  if (!pub && !prov) return null;
  return {
    ...pub,
    ...prov,
    verificado: pub?.verificado ?? prov?.verificado,
    cobros_activos: pub?.cobros_activos ?? prov?.cobros_activos,
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
