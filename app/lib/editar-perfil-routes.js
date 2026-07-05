export const EDITAR_PERFIL_HREF = "/editar-perfil";
export const EDITAR_PERFIL_SERVICIOS_HREF = "/editar-perfil?tab=servicios";

export function buildEditarPerfilTabHref(tabId) {
  if (!tabId || tabId === "perfil") return EDITAR_PERFIL_HREF;
  return `/editar-perfil?tab=${encodeURIComponent(tabId)}`;
}
