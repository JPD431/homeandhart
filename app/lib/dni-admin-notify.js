/**
 * Avisos al admin cuando un usuario sube DNI pendiente de revisión.
 * Solo usar desde rutas/API server-side (service role + Resend vía /api/emails).
 */

import { createClient } from "@supabase/supabase-js";
import { getAdminUserIds } from "@/lib/auth/admin";
import { createNotification } from "@/app/lib/notifications";

const LOG_PREFIX = "[dni-admin-notify]";
export const DNI_PENDIENTE_TIPO = "dni_pendiente_revision";
export const DNI_PENDIENTE_HREF = "/admin?tab=usuarios";

function getServiceAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function formatNombre(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() || "Usuario";
}

/**
 * Marca como leídas las notificaciones de DNI pendiente de este usuario
 * (tras verificar o rechazar).
 * @param {string} uploaderUserId
 */
export async function resolveDniPendienteNotifications(uploaderUserId) {
  if (!uploaderUserId) return;
  const admin = getServiceAdmin();
  if (!admin) return;

  const { error } = await admin
    .from("notifications")
    .update({ leida: true })
    .eq("tipo", DNI_PENDIENTE_TIPO)
    .eq("entity_id", uploaderUserId)
    .eq("leida", false);

  if (error) {
    console.error(LOG_PREFIX, "Error resolviendo notificaciones:", error.message);
  }
}

/**
 * Notifica a todos los admins (in-app + email) de un DNI pendiente.
 * Idempotente mientras siga pendiente (unique user_id+tipo+entity_id).
 * Si la notificación previa ya estaba leída (revisada), la reactiva.
 * @param {string} uploaderUserId
 * @returns {Promise<{ ok: boolean, notified: boolean, emailSent: boolean }>}
 */
export async function notifyAdminsDniPendiente(uploaderUserId) {
  if (!uploaderUserId) {
    return { ok: false, notified: false, emailSent: false };
  }

  const adminIds = getAdminUserIds();
  if (adminIds.length === 0) {
    console.error(LOG_PREFIX, "ADMIN_USER_IDS vacío; no hay destinatarios in-app");
  }

  const service = getServiceAdmin();
  if (!service) {
    return { ok: false, notified: false, emailSent: false };
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, nombre, apellido, dni_estado, doc_dni_url")
    .eq("id", uploaderUserId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error(LOG_PREFIX, "Perfil no encontrado:", profileError?.message);
    return { ok: false, notified: false, emailSent: false };
  }

  if (profile.dni_estado !== "pendiente") {
    return { ok: true, notified: false, emailSent: false };
  }

  const nombre = formatNombre(profile);
  const mensaje = `${nombre} ha subido su DNI y está pendiente de revisión.`;
  const titulo = "DNI pendiente de revisar";

  let anyFresh = false;

  for (const adminId of adminIds) {
    const result = await createNotification(null, {
      user_id: adminId,
      tipo: DNI_PENDIENTE_TIPO,
      titulo,
      mensaje,
      href: DNI_PENDIENTE_HREF,
      entity_type: "profile",
      entity_id: uploaderUserId,
    });

    if (result.ok && !result.duplicate) {
      anyFresh = true;
      continue;
    }

    if (result.duplicate) {
      // Re-subida tras revisión previa: reactivar solo si ya estaba leída
      const { data: updated, error: updError } = await service
        .from("notifications")
        .update({ leida: false, titulo, mensaje, href: DNI_PENDIENTE_HREF })
        .eq("user_id", adminId)
        .eq("tipo", DNI_PENDIENTE_TIPO)
        .eq("entity_id", uploaderUserId)
        .eq("leida", true)
        .select("id")
        .maybeSingle();

      if (updError) {
        console.error(LOG_PREFIX, "Error reactivando notificación:", updError.message);
      } else if (updated?.id) {
        anyFresh = true;
      }
      // Si seguía sin leer → idempotente, no cuenta como fresh
    }
  }

  let emailSent = false;
  // Solo email si hay aviso nuevo o reactivado (idempotente mientras siga pendiente).
  // Si no hay ADMIN_USER_IDS, igual avisamos por email a soporte@.
  if (anyFresh || adminIds.length === 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_URL;
      if (!baseUrl) {
        console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, email omitido");
      } else {
        const res = await fetch(`${baseUrl}/api/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "admin_dni_pendiente",
            nombre,
            user_id: uploaderUserId,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          console.error(LOG_PREFIX, "Email falló:", payload.error || res.status);
        } else {
          emailSent = true;
        }
      }
    } catch (err) {
      console.error(LOG_PREFIX, "Email excepción:", err?.message || err);
    }
  }

  return {
    ok: true,
    notified: anyFresh,
    emailSent,
  };
}
