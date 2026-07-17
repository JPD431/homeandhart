/**
 * Avisos de moderación de servicios (admin + proveedor).
 * Solo usar desde rutas/API server-side (service role + Resend vía /api/emails).
 */

import { createClient } from "@supabase/supabase-js";
import { getAdminUserIds } from "@/lib/auth/admin";
import { createNotification } from "@/app/lib/notifications";
import {
  REVISION_APROBADO,
  REVISION_EN_REVISION,
  REVISION_RECHAZADO,
} from "@/app/lib/onboarding-persist";

const LOG_PREFIX = "[service-revision-notify]";

export const SERVICIO_PENDIENTE_TIPO = "servicio_pendiente_revision";
export const SERVICIO_PENDIENTE_HREF = "/admin?tab=servicios-revision";
export const SERVICIO_APROBADO_TIPO = "servicio_aprobado";
export const SERVICIO_RECHAZADO_TIPO = "servicio_rechazado";

function getServiceAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function formatNombre(profile) {
  return (
    [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() ||
    "Proveedor"
  );
}

function tituloServicio(service) {
  return String(service?.titulo || "").trim() || "Tu servicio";
}

/**
 * Marca como leídas las notificaciones admin de un servicio pendiente.
 * @param {string} serviceId
 */
export async function resolveServicioPendienteNotifications(serviceId) {
  if (!serviceId) return;
  const admin = getServiceAdmin();
  if (!admin) return;

  const { error } = await admin
    .from("notifications")
    .update({ leida: true })
    .eq("tipo", SERVICIO_PENDIENTE_TIPO)
    .eq("entity_id", serviceId)
    .eq("leida", false);

  if (error) {
    console.error(LOG_PREFIX, "Error resolviendo notificaciones:", error.message);
  }
}

/**
 * Notifica a admins de un servicio en_revision.
 * Idempotente mientras siga pendiente (unique user_id+tipo+entity_id).
 * @param {string} serviceId
 */
export async function notifyAdminsServicioPendiente(serviceId) {
  if (!serviceId) {
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

  const { data: row, error: fetchError } = await service
    .from("services")
    .select(
      "id, titulo, vertical, revision_estado, proveedor_id, profiles!proveedor_id(nombre, apellido)",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (fetchError || !row) {
    console.error(LOG_PREFIX, "Servicio no encontrado:", fetchError?.message);
    return { ok: false, notified: false, emailSent: false };
  }

  if (row.revision_estado !== REVISION_EN_REVISION) {
    return { ok: true, notified: false, emailSent: false };
  }

  const nombre = formatNombre(row.profiles);
  const tituloSvc = tituloServicio(row);
  const mensaje = `${nombre} tiene el servicio «${tituloSvc}» pendiente de revisión.`;
  const titulo = "Servicio pendiente de revisar";

  let anyFresh = false;

  for (const adminId of adminIds) {
    const result = await createNotification(null, {
      user_id: adminId,
      tipo: SERVICIO_PENDIENTE_TIPO,
      titulo,
      mensaje,
      href: SERVICIO_PENDIENTE_HREF,
      entity_type: "service",
      entity_id: serviceId,
    });

    if (result.ok && !result.duplicate) {
      anyFresh = true;
      continue;
    }

    if (result.duplicate) {
      const { data: updated, error: updError } = await service
        .from("notifications")
        .update({
          leida: false,
          titulo,
          mensaje,
          href: SERVICIO_PENDIENTE_HREF,
        })
        .eq("user_id", adminId)
        .eq("tipo", SERVICIO_PENDIENTE_TIPO)
        .eq("entity_id", serviceId)
        .eq("leida", true)
        .select("id")
        .maybeSingle();

      if (updError) {
        console.error(LOG_PREFIX, "Error reactivando notificación:", updError.message);
      } else if (updated?.id) {
        anyFresh = true;
      }
    }
  }

  let emailSent = false;
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
            tipo: "admin_servicio_pendiente",
            nombre,
            titulo: tituloSvc,
            service_id: serviceId,
            vertical: row.vertical,
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

  return { ok: true, notified: anyFresh, emailSent };
}

/**
 * Avisa al proveedor tras aprobar/rechazar un servicio (notif + email).
 * Idempotente vía unique (user_id, tipo, entity_id); si ya leída, reactiva.
 * @param {{ serviceId: string, accion: 'aprobar'|'rechazar', motivo?: string }} opts
 */
export async function notifyProveedorServicioRevision({
  serviceId,
  accion,
  motivo = "",
} = {}) {
  if (!serviceId || (accion !== "aprobar" && accion !== "rechazar")) {
    return { ok: false, notified: false, emailSent: false };
  }

  const service = getServiceAdmin();
  if (!service) {
    return { ok: false, notified: false, emailSent: false };
  }

  const { data: row, error: fetchError } = await service
    .from("services")
    .select(
      "id, titulo, proveedor_id, revision_estado, profiles!proveedor_id(nombre, apellido)",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (fetchError || !row?.proveedor_id) {
    console.error(LOG_PREFIX, "Servicio no encontrado:", fetchError?.message);
    return { ok: false, notified: false, emailSent: false };
  }

  const expected =
    accion === "aprobar" ? REVISION_APROBADO : REVISION_RECHAZADO;
  if (row.revision_estado !== expected) {
    return { ok: true, notified: false, emailSent: false };
  }

  const nombre = formatNombre(row.profiles);
  const tituloSvc = tituloServicio(row);
  const motivoTrim = typeof motivo === "string" ? motivo.trim() : "";
  const tipo =
    accion === "aprobar" ? SERVICIO_APROBADO_TIPO : SERVICIO_RECHAZADO_TIPO;
  const titulo =
    accion === "aprobar"
      ? "Tu servicio ya está publicado"
      : "Tu servicio necesita cambios";
  const mensaje =
    accion === "aprobar"
      ? `«${tituloSvc}» ya está publicado y visible para las familias.`
      : motivoTrim
        ? `«${tituloSvc}» necesita cambios: ${motivoTrim}`
        : `«${tituloSvc}» necesita cambios antes de publicarse. Edítalo y guárdalo de nuevo.`;
  const href = "/editar-perfil";

  let notified = false;
  const result = await createNotification(null, {
    user_id: row.proveedor_id,
    tipo,
    titulo,
    mensaje,
    href,
    entity_type: "service",
    entity_id: serviceId,
  });

  if (result.ok && !result.duplicate) {
    notified = true;
  } else if (result.duplicate) {
    const { data: updated, error: updError } = await service
      .from("notifications")
      .update({ leida: false, titulo, mensaje, href })
      .eq("user_id", row.proveedor_id)
      .eq("tipo", tipo)
      .eq("entity_id", serviceId)
      .eq("leida", true)
      .select("id")
      .maybeSingle();

    if (updError) {
      console.error(LOG_PREFIX, "Error reactivando notif proveedor:", updError.message);
    } else if (updated?.id) {
      notified = true;
    }
  }

  let emailSent = false;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (!baseUrl) {
      console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, email omitido");
    } else {
      const res = await fetch(`${baseUrl}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo:
            accion === "aprobar" ? "servicio_publicado" : "servicio_rechazado",
          user_id: row.proveedor_id,
          nombre,
          titulo: tituloSvc,
          service_id: serviceId,
          motivo: motivoTrim || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        console.error(LOG_PREFIX, "Email proveedor falló:", payload.error || res.status);
      } else {
        emailSent = true;
      }
    }
  } catch (err) {
    console.error(LOG_PREFIX, "Email proveedor excepción:", err?.message || err);
  }

  return { ok: true, notified, emailSent };
}
