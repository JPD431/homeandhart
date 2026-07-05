import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runActualizarEstados } from "@/app/lib/cron/actualizar-estados";
import { runCalcularRespuesta } from "@/app/lib/cron/calcular-respuesta";
import { runEmailSequences } from "@/app/lib/cron/email-sequences";

async function runTask(name, fn) {
  try {
    const result = await fn();
    return { status: "ok", result };
  } catch (err) {
    console.error(`[cron/diario] ${name} failed:`, err.message ?? err);
    return { status: "error", error: err.message || String(err) };
  }
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  const startedAt = new Date().toISOString();

  const actualizar_estados = await runTask("actualizar-estados", runActualizarEstados);
  const calcular_respuesta = await runTask("calcular-respuesta", runCalcularRespuesta);
  const email_sequences = await runTask("email-sequences", runEmailSequences);

  const tasks = {
    actualizar_estados,
    calcular_respuesta,
    email_sequences,
  };

  const allOk = Object.values(tasks).every((t) => t.status === "ok");

  return Response.json({
    success: allOk,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    tasks,
  });
}
