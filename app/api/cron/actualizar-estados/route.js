import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runActualizarEstados } from "@/app/lib/cron/actualizar-estados";

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  const result = await runActualizarEstados();

  return Response.json({
    success: true,
    ...result,
  });
}
