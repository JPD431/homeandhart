import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runCalcularRespuesta } from "@/app/lib/cron/calcular-respuesta";

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  const { stats } = await runCalcularRespuesta();

  return Response.json({ success: true, stats });
}
