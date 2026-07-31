export const EDITAR_PERFIL_HREF = "/editar-perfil";
export const EDITAR_PERFIL_SERVICIOS_HREF = "/editar-perfil?tab=servicios";

/**
 * @param {string} [tabId]
 * @param {{ serviceId?: string|null, section?: string|null }} [opts]
 */
export function buildEditarPerfilTabHref(tabId, opts = {}) {
  if (!tabId || tabId === "perfil") {
    if (opts.section) {
      const params = new URLSearchParams();
      params.set("section", opts.section);
      return `${EDITAR_PERFIL_HREF}?${params.toString()}`;
    }
    return EDITAR_PERFIL_HREF;
  }
  const params = new URLSearchParams();
  params.set("tab", tabId);
  if (opts.serviceId) {
    params.set("serviceId", opts.serviceId);
  }
  if (opts.section) {
    params.set("section", opts.section);
  }
  return `/editar-perfil?${params.toString()}`;
}

/** Deep-link: abrir un servicio concreto en edición dentro de la lista. */
export function buildEditarPerfilServicioHref(serviceId, section) {
  return buildEditarPerfilTabHref("servicios", { serviceId, section });
}
