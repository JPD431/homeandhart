import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  jobEmailLogs,
  jobFavoritos,
  jobInactiveAccounts,
  jobMessages,
  jobNotificationsRead,
  jobReferenciasPending,
  jobReportsResolved,
  jobServicePhotosOrphan,
  jobStripeAlerts,
} from "@/app/lib/cron/retention-jobs";
import { RETENTION, RETENTION_UNTOUCHABLE_TABLES } from "@/app/lib/retention-policy";

function getAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const JOBS = [
  { id: "notifications_read", run: jobNotificationsRead },
  { id: "email_logs", run: jobEmailLogs },
  { id: "stripe_alerts", run: jobStripeAlerts },
  { id: "reports_resolved", run: jobReportsResolved },
  { id: "messages", run: jobMessages },
  { id: "favoritos", run: jobFavoritos },
  { id: "referencias_pending", run: jobReferenciasPending },
  { id: "service_photos_orphan", run: jobServicePhotosOrphan },
  { id: "inactive_accounts", run: jobInactiveAccounts },
];

async function logRetentionRun(admin, row) {
  if (!admin) return;
  try {
    await admin.from("retention_runs").insert(row);
  } catch (err) {
    // Tabla opcional: si no existe, solo console
    console.warn(
      "[retention] retention_runs insert omitido:",
      err?.message || err,
    );
  }
}

/**
 * Cron de retención RGPD.
 * Por defecto dry_run=true (solo cuenta). Todo desactivado mientras RETENTION.* = null.
 *
 * Activación (cuando el abogado fije plazos en retention-policy.js):
 *   GET /api/cron/retention?dry_run=true   — simular
 *   GET /api/cron/retention?dry_run=false  — ejecutar
 * Auth: igual que otros crons (CRON_SECRET / Bearer).
 * No está en vercel.json aún; añadirlo cuando haya plazos.
 *
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function runCronRetention(opts = {}) {
  const dryRun = opts.dryRun !== false; // default true
  const startedAt = new Date().toISOString();
  const admin = getAdmin();

  if (!admin) {
    return {
      success: false,
      dry_run: dryRun,
      error: "Configuración incompleta (service role).",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
  }

  console.log(
    `[retention] start dry_run=${dryRun} policy=`,
    JSON.stringify(RETENTION),
  );
  console.log(
    `[retention] untouchable tables:`,
    RETENTION_UNTOUCHABLE_TABLES.join(", "),
  );

  /** @type {Record<string, object>} */
  const tasks = {};

  for (const job of JOBS) {
    const jobStarted = new Date().toISOString();
    try {
      const result = await job.run(admin, dryRun);
      tasks[job.id] = { status: result.status || "ok", result };
      console.log(
        `[retention] job=${job.id} status=${result.status} affected=${result.affected ?? 0}`,
        result.details || "",
      );
      await logRetentionRun(admin, {
        started_at: jobStarted,
        finished_at: new Date().toISOString(),
        dry_run: dryRun,
        job: job.id,
        status: result.status || "ok",
        affected: result.affected ?? 0,
        details: result.details || {},
        error: result.error || null,
      });
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`[retention] job=${job.id} FAILED:`, message);
      tasks[job.id] = { status: "error", error: message };
      await logRetentionRun(admin, {
        started_at: jobStarted,
        finished_at: new Date().toISOString(),
        dry_run: dryRun,
        job: job.id,
        status: "error",
        affected: 0,
        details: {},
        error: message,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const allOk = Object.values(tasks).every((t) => {
    const s = t.result?.status || t.status;
    return s === "ok" || s === "skipped";
  });

  return {
    success: allOk,
    dry_run: dryRun,
    started_at: startedAt,
    finished_at: finishedAt,
    retention_policy: RETENTION,
    untouchable: RETENTION_UNTOUCHABLE_TABLES,
    tasks,
    note:
      "Por defecto dry_run=true. Plazos null = jobs skipped. No programado en vercel.json hasta tener plazos del abogado.",
  };
}
