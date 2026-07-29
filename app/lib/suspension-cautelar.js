import "server-only";

import { createClient } from "@supabase/supabase-js";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import {
  isMotivoGrave,
  SUSPENSION_CAUTELAR_POR_SISTEMA,
} from "@/app/lib/report-severity";
import { resolverNombreUsuario } from "@/app/lib/email-usuario";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Suspende cautelarmente a un proveedor: estado + pausa todos los servicios +
 * marca reservas confirmadas/en_curso para revisión. Idempotente (sin re-email).
 *
 * @param {string} proveedorId
 * @param {{ motivo?: string|null, reportId?: string|null, por?: string|null }} [opts]
 */
export async function suspenderProveedorCautelar(
  proveedorId,
  { motivo = null, reportId = null, por = SUSPENSION_CAUTELAR_POR_SISTEMA } = {},
) {
  if (!proveedorId || typeof proveedorId !== "string") {
    return { ok: false, error: "Falta proveedorId" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, nombre, apellido, role, suspendido_cautelar")
    .eq("id", proveedorId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (!profile) {
    return { ok: false, error: "Proveedor no encontrado" };
  }

  if (profile.suspendido_cautelar === true) {
    return {
      ok: true,
      already_suspended: true,
      servicios_pausados: 0,
      reservas_marcadas: 0,
    };
  }

  const now = new Date().toISOString();
  const porFinal =
    typeof por === "string" && por.trim()
      ? por.trim()
      : SUSPENSION_CAUTELAR_POR_SISTEMA;
  const motivoFinal =
    typeof motivo === "string" && motivo.trim() ? motivo.trim() : null;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      suspendido_cautelar: true,
      suspendido_cautelar_at: now,
      suspendido_cautelar_por: porFinal,
      suspendido_cautelar_motivo: motivoFinal,
      suspendido_cautelar_report_id: reportId || null,
    })
    .eq("id", proveedorId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: paused, error: pauseError } = await supabaseAdmin
    .from("services")
    .update({ disponible: false })
    .eq("proveedor_id", proveedorId)
    .eq("disponible", true)
    .select("id");

  if (pauseError) {
    console.error(
      "[suspenderProveedorCautelar] pausa servicios:",
      pauseError.message,
    );
  }

  let reservasMarcadas = 0;
  const { data: serviceRows, error: servicesError } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("proveedor_id", proveedorId);

  if (servicesError) {
    console.error(
      "[suspenderProveedorCautelar] listar servicios:",
      servicesError.message,
    );
  } else {
    const serviceIds = (serviceRows ?? []).map((s) => s.id);
    if (serviceIds.length > 0) {
      const { data: markedBookings, error: markBookingsError } =
        await supabaseAdmin
          .from("bookings")
          .update({ revision_seguridad_pendiente: true })
          .in("service_id", serviceIds)
          .in("estado", ["confirmada", "en_curso"])
          .select("id");

      if (markBookingsError) {
        console.error(
          "[suspenderProveedorCautelar] marcar reservas:",
          markBookingsError.message,
        );
      } else {
        reservasMarcadas = (markedBookings ?? []).length;
      }
    }
  }

  const proveedorNombre =
    [profile.nombre, profile.apellido].filter(Boolean).join(" ") ||
    (await resolverNombreUsuario(proveedorId)) ||
    "Proveedor";

  try {
    const result = await sendPlatformEmail({
      tipo: "admin_suspension_cautelar",
      proveedor_id: proveedorId,
      proveedor_nombre: proveedorNombre,
      motivo: motivoFinal || "—",
      report_id: reportId || null,
      servicios_pausados: (paused ?? []).length,
      reservas_marcadas: reservasMarcadas,
    });
    if (!result.ok) {
      console.error(
        "[suspenderProveedorCautelar] email urgente:",
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[suspenderProveedorCautelar] email urgente:", err);
  }

  return {
    ok: true,
    already_suspended: false,
    servicios_pausados: (paused ?? []).length,
    reservas_marcadas: reservasMarcadas,
  };
}

/**
 * Levanta la suspensión cautelar. No reactiva servicios (el proveedor debe pasar gates).
 *
 * @param {string} proveedorId
 * @param {string} adminId
 */
export async function levantarSuspensionCautelar(proveedorId, adminId) {
  if (!proveedorId || typeof proveedorId !== "string") {
    return { ok: false, error: "Falta proveedorId" };
  }
  if (!adminId || typeof adminId !== "string") {
    return { ok: false, error: "Falta adminId" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, suspendido_cautelar")
    .eq("id", proveedorId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (!profile) {
    return { ok: false, error: "Proveedor no encontrado" };
  }

  if (profile.suspendido_cautelar !== true) {
    return { ok: true, already_clear: true };
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      suspendido_cautelar: false,
      suspendido_cautelar_at: null,
      suspendido_cautelar_por: null,
      suspendido_cautelar_motivo: null,
      suspendido_cautelar_report_id: null,
    })
    .eq("id", proveedorId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, already_clear: false, levantado_por: adminId };
}

/**
 * Si el reporte es grave y el reportado es proveedor, aplica suspensión cautelar.
 */
export async function maybeSuspenderPorReporteGrave({
  reportedId,
  motivo,
  reportId,
  reportedIsProveedor,
}) {
  if (!reportedIsProveedor || !isMotivoGrave(motivo)) {
    return { applied: false };
  }

  const result = await suspenderProveedorCautelar(reportedId, {
    motivo,
    reportId,
    por: SUSPENSION_CAUTELAR_POR_SISTEMA,
  });

  return { applied: result.ok === true, result };
}
