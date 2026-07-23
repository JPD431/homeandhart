import {
  isInternalApiAuthorized,
  unauthorizedInternalResponse,
} from "@/app/lib/internal-api-auth";

/**
 * Auth de crons Vercel / disparos internos.
 * Delega en la implementación fail-closed + timing-safe central.
 */
export function verifyCronAuth(request) {
  return isInternalApiAuthorized(request);
}

export function unauthorizedCronResponse() {
  return unauthorizedInternalResponse();
}
