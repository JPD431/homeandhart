import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runCronRetention } from "@/app/lib/cron/retention";

/**
 * GET /api/cron/retention
 * Query:
 *   dry_run=true  (default) — solo cuenta / simula
 *   dry_run=false — aplica borrados/anonimizaciones
 *
 * Auth: CRON_SECRET (igual que /api/cron/diario). Sin rate-limit de usuario.
 *
 * Activación: fijar días en app/lib/retention-policy.js y, cuando proceda,
 * añadir schedule en vercel.json. Con todo null no borra nada.
 */
export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  const param = request.nextUrl.searchParams.get("dry_run");
  // Default dry_run=true; solo false explícito ejecuta
  const dryRun = param !== "false" && param !== "0";

  const payload = await runCronRetention({ dryRun });
  return Response.json(payload);
}
