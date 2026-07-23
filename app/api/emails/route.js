import {
  isInternalApiAuthorized,
  unauthorizedInternalResponse,
} from "@/app/lib/internal-api-auth";
import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";

/**
 * Capa HTTP fina: solo server-to-server con Authorization: Bearer CRON_SECRET.
 * Los flujos internos deben usar sendPlatformEmail / dispatchPlatformEmail
 * (import directo, sin self-fetch).
 */
export async function POST(request) {
  if (!isInternalApiAuthorized(request)) {
    return unauthorizedInternalResponse();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const result = await dispatchPlatformEmail(body);

  if (!result.ok) {
    return Response.json(
      { error: result.error || "Error al enviar email" },
      { status: result.status || 500 },
    );
  }

  return Response.json(result.data ?? { success: true });
}
