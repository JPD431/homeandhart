/**
 * Avisa al proveedor cuando el admin verifica o rechaza su DNI.
 * Email + notificación in-app. Excluye cuentas internas.
 */

import { createClient } from "@supabase/supabase-js";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import { createNotification } from "@/app/lib/notifications";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const LOG_PREFIX = "[dni-proveedor-notify]";

export const DNI_VERIFICADO_TIPO = "dni_verificado";
export const DNI_RECHAZADO_TIPO = "dni_rechazado";

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
 * @param {{
 *   userId: string,
 *   estado: 'verificado' | 'rechazado',
 *   motivo?: string | null,
 * }} opts
 */
export async function notifyProveedorDniDecision({
  userId,
  estado,
  motivo = "",
} = {}) {
  if (!userId || (estado !== "verificado" && estado !== "rechazado")) {
    return { ok: false, notified: false, emailSent: false };
  }

  const admin = getAdmin();
  if (!admin) {
    return { ok: false, notified: false, emailSent: false };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, nombre, apellido")
    .eq("id", userId)
    .maybeSingle();

  const nombre =
    [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() ||
    "proveedor";
  const motivoTrim = typeof motivo === "string" ? motivo.trim() : "";

  const verified = estado === "verificado";
  const tipo = verified ? DNI_VERIFICADO_TIPO : DNI_RECHAZADO_TIPO;
  const titulo = verified
    ? "Tu identidad ha sido verificada"
    : "Necesitamos que vuelvas a subir tu documento";
  const mensaje = verified
    ? "Hemos verificado tu documento de identidad y tu mayoría de edad. Ya puedes seguir con los siguientes pasos de tu cuenta."
    : motivoTrim
      ? `Tu documento de identidad no ha podido verificarse: ${motivoTrim}. Súbelo de nuevo desde tu perfil.`
      : "Tu documento de identidad no ha podido verificarse. Súbelo de nuevo desde tu perfil.";
  const href = verified ? "/dashboard?tab=proveedor" : "/subir-dni";

  let notified = false;
  const notifResult = await createNotification(null, {
    user_id: userId,
    tipo,
    titulo,
    mensaje,
    href,
    entity_type: "profile",
    entity_id: userId,
  });

  if (notifResult.ok && !notifResult.duplicate) {
    notified = true;
  } else if (notifResult.duplicate) {
    const { data: updated, error: updError } = await admin
      .from("notifications")
      .update({ leida: false, titulo, mensaje, href })
      .eq("user_id", userId)
      .eq("tipo", tipo)
      .eq("entity_id", userId)
      .select("id")
      .maybeSingle();

    if (updError) {
      console.error(LOG_PREFIX, "Error reactivando notif:", updError.message);
    } else if (updated?.id) {
      notified = true;
    }
  }

  let emailSent = false;
  if (!isExcludedFromUserEmailSequences(userId)) {
    try {
      const result = await sendPlatformEmail({
        tipo: verified ? "dni_verificado" : "dni_rechazado",
        user_id: userId,
        nombre,
        motivo: motivoTrim || undefined,
      });
      if (!result.ok) {
        console.error(LOG_PREFIX, "Email falló:", result.error || result.status);
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error(LOG_PREFIX, "Email excepción:", err?.message || err);
    }
  }

  return { ok: true, notified, emailSent };
}
