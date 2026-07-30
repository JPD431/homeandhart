/**
 * Límites anti-abuso de servicios por proveedor (proporcionados).
 */

export const MAX_SERVICES_PER_PROVIDER = 50;
export const SERVICE_BURST_ALERT_THRESHOLD = 5;
export const SERVICE_BURST_WINDOW_MS = 24 * 60 * 60 * 1000;

export const MAX_SERVICES_MESSAGE =
  "Has alcanzado el máximo de anuncios; contacta con soporte si necesitas más.";

/**
 * Cuenta servicios del proveedor (cualquier estado; anti-spam de borradores).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} proveedorId
 */
export async function countProviderServices(supabase, proveedorId) {
  if (!proveedorId) return 0;
  const { count, error } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("proveedor_id", proveedorId);

  if (error) {
    console.error("[service-limits] count error:", error.message);
    throw error;
  }
  return count ?? 0;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} proveedorId
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function assertCanCreateService(supabase, proveedorId) {
  const n = await countProviderServices(supabase, proveedorId);
  if (n >= MAX_SERVICES_PER_PROVIDER) {
    return { ok: false, error: MAX_SERVICES_MESSAGE };
  }
  return { ok: true };
}

/**
 * Dispara (fire-and-forget) la comprobación de creación masiva en el servidor.
 * No bloquea ni lanza.
 */
export function maybeNotifyServiceCreationBurst() {
  if (typeof fetch !== "function") return;
  try {
    void fetch("/api/services/creation-burst-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
  } catch {
    // ignore
  }
}
