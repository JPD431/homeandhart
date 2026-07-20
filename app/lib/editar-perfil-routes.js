export const EDITAR_PERFIL_HREF = "/editar-perfil";
export const EDITAR_PERFIL_SERVICIOS_HREF = "/editar-perfil?tab=servicios";

/**
 * @param {string} [tabId]
 * @param {{ serviceId?: string|null }} [opts]
 */
export function buildEditarPerfilTabHref(tabId, opts = {}) {
  if (!tabId || tabId === "perfil") return EDITAR_PERFIL_HREF;
  const params = new URLSearchParams();
  params.set("tab", tabId);
  if (opts.serviceId) {
    params.set("serviceId", opts.serviceId);
  }
  return `/editar-perfil?${params.toString()}`;
}

/** Deep-link: abrir un servicio concreto en edición dentro de la lista. */
export function buildEditarPerfilServicioHref(serviceId) {
  return buildEditarPerfilTabHref("servicios", { serviceId });
}
