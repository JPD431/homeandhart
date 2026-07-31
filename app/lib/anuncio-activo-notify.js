/**
 * Notifica al proveedor cuando sus anuncios pasan a disponibles
 * tras configurar cobros (Stripe Connect listo).
 */

import { createClient } from "@supabase/supabase-js";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import { createNotification } from "@/app/lib/notifications";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const LOG_PREFIX = "[anuncio-activo-notify]";
export const ANUNCIOS_ACTIVOS_TIPO = "anuncios_activos_cobros";

function getAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * @param {{ userId: string, serviceIds?: string[], count?: number }} opts
 */
export async function notifyProveedorAnunciosActivos({
  userId,
  serviceIds = [],
  count = 0,
} = {}) {
  if (!userId || (count <= 0 && serviceIds.length === 0)) {
    return { ok: false, notified: false, emailSent: false };
  }

  const admin = getAdmin();
  if (!admin) return { ok: false, notified: false, emailSent: false };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, nombre")
    .eq("id", userId)
    .maybeSingle();

  const nombre = profile?.nombre || "proveedor";
  const n = count || serviceIds.length;
  const titulo =
    n === 1
      ? "¡Tu anuncio ya está activo!"
      : `¡Tus ${n} anuncios ya están activos!`;
  const mensaje =
    n === 1
      ? "Ya puedes recibir reservas. Tu anuncio es visible para las familias."
      : "Ya puedes recibir reservas. Tus anuncios son visibles para las familias.";
  const href = "/editar-perfil?tab=servicios";
  const entityId = userId;

  let notified = false;
  const notifResult = await createNotification(null, {
    user_id: userId,
    tipo: ANUNCIOS_ACTIVOS_TIPO,
    titulo,
    mensaje,
    href,
    entity_type: "profile",
    entity_id: entityId,
  });

  if (notifResult.ok && !notifResult.duplicate) {
    notified = true;
  } else if (notifResult.duplicate) {
    const { data: updated } = await admin
      .from("notifications")
      .update({ leida: false, titulo, mensaje, href })
      .eq("user_id", userId)
      .eq("tipo", ANUNCIOS_ACTIVOS_TIPO)
      .eq("entity_id", entityId)
      .select("id")
      .maybeSingle();
    if (updated?.id) notified = true;
  }

  let emailSent = false;
  if (!isExcludedFromUserEmailSequences(userId)) {
    try {
      const result = await sendPlatformEmail({
        tipo: "anuncios_activos_cobros",
        user_id: userId,
        nombre,
        count: n,
      });
      if (result.ok) emailSent = true;
      else {
        console.error(LOG_PREFIX, "Email falló:", result.error || result.status);
      }
    } catch (err) {
      console.error(LOG_PREFIX, "Email excepción:", err?.message || err);
    }
  }

  return { ok: true, notified, emailSent };
}
