import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runCronDiario } from "@/app/lib/cron/diario";

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  const payload = await runCronDiario();
  return Response.json(payload);
}
