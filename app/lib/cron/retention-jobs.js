import "server-only";

import { executeAccountAnonymizationAndBan } from "@/app/lib/delete-account-execute";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import { extractMediaStoragePath } from "@/app/lib/delete-account-storage";
import { STORAGE_BUCKET_MEDIA } from "@/app/lib/storage-buckets";
import {
  INACTIVE_WARNING_GRACE_DAYS,
  RETENTION,
  RETENTION_BATCH_SIZE,
  assertRetentionSafe,
  cutoffIsoFromDays,
  resolveRetentionDays,
} from "@/app/lib/retention-policy";

const ACTIVE_BOOKING_STATES = ["pendiente", "confirmada", "en_curso"];
const MSG_PLACEHOLDER = "[mensaje eliminado por antigüedad]";
const INACTIVE_WARNING_TIPO = "cuenta_inactiva_aviso";

/**
 * @typedef {{ dryRun: boolean, affected: number, skipped?: number, details?: object, status: 'ok'|'skipped'|'error', error?: string }} JobResult
 */

function skipped(reason) {
  console.log(`[retention] ${reason}`);
  return { dryRun: true, affected: 0, status: "skipped", details: { reason } };
}

function daysOrSkip(key) {
  const days = resolveRetentionDays(RETENTION[key], key);
  if (days == null) {
    return { days: null, result: skipped(`${key}: desactivado`) };
  }
  return { days, result: null };
}

async function selectIds(admin, table, buildQuery) {
  let q = admin.from(table).select("id");
  q = buildQuery(q);
  const { data, error } = await q.limit(RETENTION_BATCH_SIZE);
  if (error) throw error;
  return (data || []).map((r) => r.id).filter(Boolean);
}

/**
 * Notificaciones leídas antiguas → DELETE
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {boolean} dryRun
 * @returns {Promise<JobResult>}
 */
export async function jobNotificationsRead(admin, dryRun) {
  assertRetentionSafe(["notifications"]);
  const { days, result } = daysOrSkip("NOTIFICATIONS_READ_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const ids = await selectIds(admin, "notifications", (q) =>
    q.eq("leida", true).lt("created_at", cutoff),
  );

  if (dryRun || ids.length === 0) {
    return {
      dryRun,
      affected: ids.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_delete" : "none" },
    };
  }

  const { error } = await admin.from("notifications").delete().in("id", ids);
  if (error) throw error;
  return {
    dryRun: false,
    affected: ids.length,
    status: "ok",
    details: { cutoff, action: "deleted" },
  };
}

/**
 * email_logs antiguos → DELETE
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {boolean} dryRun
 */
export async function jobEmailLogs(admin, dryRun) {
  assertRetentionSafe(["email_logs"]);
  const { days, result } = daysOrSkip("EMAIL_LOGS_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  // Schema: enviado_at (fallback created_at si existiera)
  let ids = [];
  try {
    ids = await selectIds(admin, "email_logs", (q) =>
      q.lt("enviado_at", cutoff),
    );
  } catch (err) {
    console.warn(
      "[retention] email_logs.enviado_at falló, probando created_at:",
      err?.message,
    );
    ids = await selectIds(admin, "email_logs", (q) =>
      q.lt("created_at", cutoff),
    );
  }

  if (dryRun || ids.length === 0) {
    return {
      dryRun,
      affected: ids.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_delete" : "none" },
    };
  }

  const { error } = await admin.from("email_logs").delete().in("id", ids);
  if (error) throw error;
  return {
    dryRun: false,
    affected: ids.length,
    status: "ok",
    details: { cutoff, action: "deleted" },
  };
}

/**
 * stripe_descuadre_alerts → DELETE
 */
export async function jobStripeAlerts(admin, dryRun) {
  assertRetentionSafe(["stripe_descuadre_alerts"]);
  const { days, result } = daysOrSkip("STRIPE_ALERTS_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  // PK es dedupe_key, no id
  const { data, error } = await admin
    .from("stripe_descuadre_alerts")
    .select("dedupe_key")
    .lt("created_at", cutoff)
    .limit(RETENTION_BATCH_SIZE);
  if (error) throw error;
  const keys = (data || []).map((r) => r.dedupe_key).filter(Boolean);

  if (dryRun || keys.length === 0) {
    return {
      dryRun,
      affected: keys.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_delete" : "none" },
    };
  }

  const { error: delErr } = await admin
    .from("stripe_descuadre_alerts")
    .delete()
    .in("dedupe_key", keys);
  if (delErr) throw delErr;
  return {
    dryRun: false,
    affected: keys.length,
    status: "ok",
    details: { cutoff, action: "deleted" },
  };
}

/**
 * Reports resueltos → scrub descripcion/motivo (no toca bookings)
 */
export async function jobReportsResolved(admin, dryRun) {
  assertRetentionSafe(["reports"]);
  const { days, result } = daysOrSkip("REPORTS_RESOLVED_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const { data, error } = await admin
    .from("reports")
    .select("id, descripcion, motivo")
    .eq("estado", "resuelto")
    .lt("created_at", cutoff)
    .or("descripcion.not.is.null,motivo.not.is.null")
    .limit(RETENTION_BATCH_SIZE);
  if (error) throw error;
  const rows = data || [];
  const ids = rows.map((r) => r.id);

  if (dryRun || ids.length === 0) {
    return {
      dryRun,
      affected: ids.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_scrub" : "none" },
    };
  }

  const { error: updErr } = await admin
    .from("reports")
    .update({ descripcion: null, motivo: "[eliminado por antigüedad]" })
    .in("id", ids);
  if (updErr) throw updErr;
  return {
    dryRun: false,
    affected: ids.length,
    status: "ok",
    details: { cutoff, action: "scrubbed" },
  };
}

/**
 * Mensajes: anonimizar content si conversación sin reserva activa
 * y último mensaje anterior al cutoff.
 */
export async function jobMessages(admin, dryRun) {
  assertRetentionSafe(["messages", "conversations"]);
  const { days, result } = daysOrSkip("MESSAGES_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);

  // Último mensaje por conversación (lote de mensajes antiguos candidatos)
  const { data: oldMsgs, error: msgErr } = await admin
    .from("messages")
    .select("id, conversation_id, content, created_at")
    .lt("created_at", cutoff)
    .neq("content", MSG_PLACEHOLDER)
    .order("created_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);
  if (msgErr) throw msgErr;

  const candidates = oldMsgs || [];
  if (candidates.length === 0) {
    return {
      dryRun,
      affected: 0,
      status: "ok",
      details: { cutoff, action: "none" },
    };
  }

  const convIds = [...new Set(candidates.map((m) => m.conversation_id))];
  const { data: convs, error: convErr } = await admin
    .from("conversations")
    .select("id, participant_a_id, participant_b_id")
    .in("id", convIds);
  if (convErr) throw convErr;

  const convMap = Object.fromEntries((convs || []).map((c) => [c.id, c]));

  // Comprobar reserva activa entre participantes (por conversación)
  const hasActive = {};
  for (const c of convs || []) {
    const a = c.participant_a_id;
    const b = c.participant_b_id;
    const { data: asCliente } = await admin
      .from("bookings")
      .select("id, services!inner(proveedor_id)")
      .eq("cliente_id", a)
      .in("estado", ACTIVE_BOOKING_STATES)
      .eq("services.proveedor_id", b)
      .limit(1);
    if (asCliente?.length) {
      hasActive[c.id] = true;
      continue;
    }
    const { data: asProv } = await admin
      .from("bookings")
      .select("id, services!inner(proveedor_id)")
      .eq("cliente_id", b)
      .in("estado", ACTIVE_BOOKING_STATES)
      .eq("services.proveedor_id", a)
      .limit(1);
    hasActive[c.id] = Boolean(asProv?.length);
  }

  // Solo mensajes cuyo último mensaje de la conversación también es < cutoff
  // (si hay actividad reciente, no tocar)
  const lastByConv = {};
  const { data: recentCheck } = await admin
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  for (const m of recentCheck || []) {
    if (!lastByConv[m.conversation_id]) {
      lastByConv[m.conversation_id] = m.created_at;
    }
  }

  const toAnonymize = candidates.filter((m) => {
    if (!convMap[m.conversation_id]) return false;
    if (hasActive[m.conversation_id]) return false;
    const last = lastByConv[m.conversation_id];
    if (last && new Date(last) >= new Date(cutoff)) return false;
    return true;
  });
  const ids = toAnonymize.map((m) => m.id);

  if (dryRun || ids.length === 0) {
    return {
      dryRun,
      affected: ids.length,
      skipped: candidates.length - ids.length,
      status: "ok",
      details: {
        cutoff,
        action: dryRun ? "would_anonymize" : "none",
        skipped_active_or_recent: candidates.length - ids.length,
      },
    };
  }

  const { error: updErr } = await admin
    .from("messages")
    .update({ content: MSG_PLACEHOLDER })
    .in("id", ids);
  if (updErr) throw updErr;
  return {
    dryRun: false,
    affected: ids.length,
    status: "ok",
    details: { cutoff, action: "anonymized" },
  };
}

/**
 * Favoritos antiguos → DELETE (PK compuesta cliente_id+proveedor_id)
 */
export async function jobFavoritos(admin, dryRun) {
  assertRetentionSafe(["favoritos"]);
  const { days, result } = daysOrSkip("FAVORITOS_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const { data, error } = await admin
    .from("favoritos")
    .select("cliente_id, proveedor_id")
    .lt("created_at", cutoff)
    .limit(RETENTION_BATCH_SIZE);
  if (error) {
    console.warn("[retention] favoritos error:", error.message);
    return {
      dryRun,
      affected: 0,
      status: "error",
      error: error.message,
    };
  }
  const rows = data || [];

  if (dryRun || rows.length === 0) {
    return {
      dryRun,
      affected: rows.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_delete" : "none" },
    };
  }

  let deleted = 0;
  for (const row of rows) {
    const { error: delErr } = await admin
      .from("favoritos")
      .delete()
      .eq("cliente_id", row.cliente_id)
      .eq("proveedor_id", row.proveedor_id);
    if (delErr) {
      console.error("[retention] favoritos delete:", delErr.message);
    } else {
      deleted += 1;
    }
  }
  return {
    dryRun: false,
    affected: deleted,
    status: "ok",
    details: { cutoff, action: "deleted" },
  };
}

/**
 * Referencias pendientes → DELETE (PII de terceros)
 */
export async function jobReferenciasPending(admin, dryRun) {
  assertRetentionSafe(["referencias"]);
  const { days, result } = daysOrSkip("REFERENCIAS_PENDING_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const ids = await selectIds(admin, "referencias", (q) =>
    q.eq("estado", "pendiente").lt("created_at", cutoff),
  );

  if (dryRun || ids.length === 0) {
    return {
      dryRun,
      affected: ids.length,
      status: "ok",
      details: { cutoff, action: dryRun ? "would_delete" : "none" },
    };
  }

  const { error } = await admin.from("referencias").delete().in("id", ids);
  if (error) throw error;
  return {
    dryRun: false,
    affected: ids.length,
    status: "ok",
    details: { cutoff, action: "deleted" },
  };
}

/**
 * Fotos de servicios pausados antiguos → borrar Storage + limpiar fotos en BD
 * (NO toca bookings)
 */
export async function jobServicePhotosOrphan(admin, dryRun) {
  assertRetentionSafe(["services"]);
  const { days, result } = daysOrSkip("SERVICE_PHOTOS_ORPHAN_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const { data: services, error } = await admin
    .from("services")
    .select("id, fotos, foto_url, disponible, updated_at")
    .eq("disponible", false)
    .lt("updated_at", cutoff)
    .limit(RETENTION_BATCH_SIZE);
  if (error) throw error;

  const targets = (services || []).filter((s) => {
    const fotos = Array.isArray(s.fotos) ? s.fotos : [];
    return Boolean(s.foto_url) || fotos.length > 0;
  });

  if (dryRun || targets.length === 0) {
    return {
      dryRun,
      affected: targets.length,
      status: "ok",
      details: {
        cutoff,
        action: dryRun ? "would_clear_photos" : "none",
        service_ids: targets.map((s) => s.id).slice(0, 20),
      },
    };
  }

  let cleared = 0;
  for (const svc of targets) {
    const paths = [];
    const fotoUrlPath = extractMediaStoragePath(svc.foto_url);
    if (fotoUrlPath) paths.push(fotoUrlPath);
    const fotos = Array.isArray(svc.fotos) ? svc.fotos : [];
    for (const f of fotos) {
      const url = typeof f === "string" ? f : f?.url;
      const p = extractMediaStoragePath(url);
      if (p) paths.push(p);
    }
    const unique = [...new Set(paths)];
    if (unique.length > 0) {
      const { error: rmErr } = await admin.storage
        .from(STORAGE_BUCKET_MEDIA)
        .remove(unique);
      if (rmErr) {
        console.error(
          "[retention] storage remove service photos:",
          svc.id,
          rmErr.message,
        );
      }
    }
    const { error: updErr } = await admin
      .from("services")
      .update({ fotos: [], foto_url: null })
      .eq("id", svc.id);
    if (updErr) {
      console.error("[retention] clear service fotos BD:", svc.id, updErr.message);
    } else {
      cleared += 1;
    }
  }

  return {
    dryRun: false,
    affected: cleared,
    status: "ok",
    details: { cutoff, action: "cleared_photos" },
  };
}

/**
 * Cuentas inactivas: aviso email → (gracia) → mismo flujo anonimizar+ban.
 * Respeta bloqueo por reservas activas.
 */
export async function jobInactiveAccounts(admin, dryRun) {
  assertRetentionSafe([]); // no toca bookings/consents/ledgers
  const { days, result } = daysOrSkip("INACTIVE_ACCOUNT_DAYS");
  if (result) return result;

  const cutoff = cutoffIsoFromDays(days);
  const graceCutoff = cutoffIsoFromDays(INACTIVE_WARNING_GRACE_DAYS);

  let page = 1;
  const perPage = 100;
  /** @type {Array<{ id: string, email?: string, last_sign_in_at?: string, created_at?: string }>} */
  const inactive = [];

  while (inactive.length < RETENTION_BATCH_SIZE && page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data?.users || [];
    if (users.length === 0) break;

    for (const u of users) {
      if (inactive.length >= RETENTION_BATCH_SIZE) break;
      const email = u.email || "";
      if (email.startsWith("deleted-")) continue;
      if (u.banned_until && new Date(u.banned_until) > new Date()) continue;
      const activity = u.last_sign_in_at || u.created_at;
      if (!activity || new Date(activity) >= new Date(cutoff)) continue;
      inactive.push({
        id: u.id,
        email,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
      });
    }

    if (users.length < perPage) break;
    page += 1;
  }

  if (dryRun) {
    return {
      dryRun: true,
      affected: inactive.length,
      status: "ok",
      details: {
        cutoff,
        action: "would_warn_or_anonymize",
        sample_ids: inactive.map((u) => u.id).slice(0, 10),
      },
    };
  }

  let warned = 0;
  let anonymized = 0;
  let blocked = 0;
  let errors = 0;

  for (const u of inactive) {
    // ¿Ya hay aviso?
    const { data: prior } = await admin
      .from("email_logs")
      .select("id, enviado_at")
      .eq("user_id", u.id)
      .eq("tipo", INACTIVE_WARNING_TIPO)
      .order("enviado_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prior) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("nombre")
          .eq("id", u.id)
          .maybeSingle();
        await sendPlatformEmail({
          tipo: INACTIVE_WARNING_TIPO,
          user_id: u.id,
          email: u.email,
          nombre: profile?.nombre || "usuario",
          days,
        });
        await admin.from("email_logs").insert({
          user_id: u.id,
          tipo: INACTIVE_WARNING_TIPO,
        });
        warned += 1;
      } catch (err) {
        console.error("[retention] inactive warning:", u.id, err?.message || err);
        errors += 1;
      }
      continue;
    }

    const warnedAt = prior.enviado_at;
    if (warnedAt && new Date(warnedAt) > new Date(graceCutoff)) {
      // Aún en periodo de gracia
      continue;
    }

    const exec = await executeAccountAnonymizationAndBan(admin, u.id);
    if (exec.ok) {
      anonymized += 1;
    } else if (exec.code === "active_bookings") {
      blocked += 1;
    } else {
      console.error("[retention] inactive anonymize:", u.id, exec.error);
      errors += 1;
    }
  }

  return {
    dryRun: false,
    affected: anonymized + warned,
    status: "ok",
    details: {
      cutoff,
      action: "warn_or_anonymize",
      warned,
      anonymized,
      blocked_active_bookings: blocked,
      errors,
      grace_days: INACTIVE_WARNING_GRACE_DAYS,
    },
  };
}
