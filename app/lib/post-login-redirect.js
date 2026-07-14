import { readStoredModoClient } from "@/app/lib/modo-persist";

const DEFAULT_REDIRECT = "/completar-perfil";

/** Destinos que no deben ajustarse por modo guardado en cliente */
const FIXED_REDIRECTS = new Set([
  "/login",
  "/admin",
  "/familia",
  "/ser-proveedor",
  "/completar-perfil",
]);

/**
 * Ajuste en cliente: cookie puede no existir aún (sesiones previas al deploy).
 * Solo aplica cuando el servidor devolvió buscar ↔ dashboard proveedor.
 */
function mergeStoredModoRedirect(serverRedirect) {
  if (FIXED_REDIRECTS.has(serverRedirect)) {
    return serverRedirect;
  }

  const stored = readStoredModoClient();
  if (!stored) return serverRedirect;

  if (
    stored === "cliente" &&
    serverRedirect.includes("tab=proveedor")
  ) {
    return "/buscar";
  }

  if (stored === "proveedor" && serverRedirect === "/buscar") {
    return "/dashboard?tab=proveedor";
  }

  return serverRedirect;
}

/** Destino post-login vía API server-side (incluye detección de admin). */
export async function fetchPostLoginRedirect() {
  try {
    const res = await fetch("/api/auth/post-login-redirect");
    const data = await res.json().catch(() => ({}));
    if (typeof data?.redirect === "string" && data.redirect.length > 0) {
      return mergeStoredModoRedirect(data.redirect);
    }
  } catch (err) {
    console.error("[post-login-redirect] Error en cliente:", err);
  }
  return DEFAULT_REDIRECT;
}
