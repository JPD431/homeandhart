import { runActualizarEstados } from "@/app/lib/cron/actualizar-estados";
import { runCalcularRespuesta } from "@/app/lib/cron/calcular-respuesta";
import { runEmailSequences } from "@/app/lib/cron/email-sequences";
import { runExpirarPendientes } from "@/app/lib/cron/expirar-pendientes";
import { runCancelHoldsHuerfanos } from "@/app/lib/cron/holds-huerfanos";

async function runTask(name, fn) {
  try {
    const result = await fn();
    return { status: "ok", result };
  } catch (err) {
    console.error(`[cron/diario] ${name} failed:`, err.message ?? err);
    return { status: "error", error: err.message || String(err) };
  }
}

/**
 * Misma lógica que GET /api/cron/diario (Vercel cron + disparo manual admin).
 */
export async function runCronDiario() {
  const startedAt = new Date().toISOString();

  const actualizar_estados = await runTask(
    "actualizar-estados",
    runActualizarEstados,
  );
  const calcular_respuesta = await runTask(
    "calcular-respuesta",
    runCalcularRespuesta,
  );
  const email_sequences = await runTask("email-sequences", runEmailSequences);
  const holds_huerfanos = await runTask(
    "holds-huerfanos",
    runCancelHoldsHuerfanos,
  );
  const expirar_pendientes = await runTask(
    "expirar-pendientes",
    runExpirarPendientes,
  );

  const tasks = {
    actualizar_estados,
    calcular_respuesta,
    email_sequences,
    holds_huerfanos,
    expirar_pendientes,
  };

  const allOk = Object.values(tasks).every((t) => taskSucceeded(t));

  return {
    success: allOk,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    tasks,
    summary: buildCronSummary(tasks),
  };
}

/** true solo si la tarea no falló y no reporta errores parciales. */
export function taskSucceeded(task) {
  if (!task || task.status !== "ok") return false;
  const errors = task.result?.errors ?? task.result?.stats?.errors;
  if (Array.isArray(errors) && errors.length > 0) return false;
  return true;
}

export function buildCronSummary(tasks) {
  const parts = [];
  const ae = tasks.actualizar_estados;
  const es = tasks.email_sequences;
  const cr = tasks.calcular_respuesta;
  const hh = tasks.holds_huerfanos;
  const ep = tasks.expirar_pendientes;

  if (ae?.status === "ok" && ae.result) {
    const { iniciadas = 0, completadas = 0, liberadas = 0 } = ae.result;
    parts.push(
      `${completadas} reservas completadas`,
      `${iniciadas} iniciadas`,
      `${liberadas} pagos liberados`,
    );
  } else if (ae?.status === "error") {
    parts.push(`actualizar-estados: error (${ae.error})`);
  }

  if (es?.status === "ok" && es.result?.stats) {
    const stats = es.result.stats;
    let emails = 0;
    for (const [key, value] of Object.entries(stats)) {
      if (key === "errors" || typeof value !== "number") continue;
      emails += value;
    }
    parts.push(`${emails} emails de secuencia`);
    if (Array.isArray(stats.errors) && stats.errors.length > 0) {
      parts.push(`${stats.errors.length} errores de email`);
    }
  } else if (es?.status === "error") {
    parts.push(`email-sequences: error (${es.error})`);
  }

  if (cr?.status === "error") {
    parts.push(`calcular-respuesta: error (${cr.error})`);
  } else if (cr?.status === "ok") {
    parts.push("tiempos de respuesta actualizados");
  }

  if (hh?.status === "ok" && hh.result) {
    parts.push(`${hh.result.canceled ?? 0} holds huérfanos cancelados`);
  } else if (hh?.status === "error") {
    parts.push(`holds-huerfanos: error (${hh.error})`);
  }

  if (ep?.status === "ok" && ep.result) {
    const {
      scanned = 0,
      expired = 0,
      skipped = 0,
      reverted = 0,
      errors = [],
    } = ep.result;
    parts.push(
      `expirar-pendientes: ${scanned} revisadas, ${expired} expiradas, ${skipped} saltadas, ${reverted} revertidas`,
    );
    if (Array.isArray(errors) && errors.length > 0) {
      const detail = errors.slice(0, 5).join("; ");
      parts.push(
        `${errors.length} error${errors.length === 1 ? "" : "es"} al expirar: ${detail}`,
      );
    }
  } else if (ep?.status === "error") {
    parts.push(`expirar-pendientes: error (${ep.error})`);
  }

  return parts.length > 0
    ? parts.join(" · ")
    : "Cron ejecutado correctamente";
}
