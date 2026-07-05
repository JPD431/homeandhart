import { verifyCronAuth, unauthorizedCronResponse } from "@/app/lib/cron/auth";
import { runEmailSequences } from "@/app/lib/cron/email-sequences";

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedCronResponse();
  }

  try {
    const { stats, sequences } = await runEmailSequences();
    return Response.json({ success: true, stats, sequences });
  } catch (err) {
    return Response.json(
      { error: err.message || "Error en cron email-sequences" },
      { status: 500 },
    );
  }
}
