import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { isInternalApiAuthorized } from "@/app/lib/internal-api-auth";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function isCronInternalCall(request) {
  return isInternalApiAuthorized(request);
}

/** Llamadas server-to-server (cron, rollback interno futuro). */
export function authorizeInternalCron(request) {
  if (isCronInternalCall(request)) {
    return { ok: true, source: "cron" };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}

/**
 * Admin o cron interno (p. ej. transfer legacy).
 */
export async function authorizeAdminOrCron(request) {
  if (isCronInternalCall(request)) {
    return { ok: true, source: "cron" };
  }
  const admin = await getAdminUser();
  if (admin) {
    return { ok: true, source: "admin", user: admin };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}

/**
 * Cliente autenticado dueño del PI (metadata o booking) o admin o cron.
 */
export async function authorizePaymentIntentOwner(request, paymentIntentId, stripe) {
  if (!paymentIntentId) {
    return { ok: false, status: 400, error: "Falta paymentIntentId" };
  }

  if (isCronInternalCall(request)) {
    return { ok: true, source: "cron" };
  }

  const admin = await getAdminUser();
  if (admin) {
    return { ok: true, source: "admin", user: admin };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.metadata?.cliente_id === user.id) {
    return { ok: true, source: "client_metadata", user, paymentIntent };
  }

  const { data: ownedBooking } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("payment_intent_id", paymentIntentId)
    .eq("cliente_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedBooking) {
    return { ok: true, source: "client_booking", user, paymentIntent };
  }

  return {
    ok: false,
    status: 403,
    error: "No tienes permiso para operar sobre este pago.",
  };
}

/**
 * Cliente autenticado creando/operando su propio pago.
 */
export async function authorizeAuthenticatedClient(request, { clienteId } = {}) {
  if (isCronInternalCall(request)) {
    return { ok: true, source: "cron" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  if (clienteId && clienteId !== user.id) {
    return {
      ok: false,
      status: 403,
      error: "No puedes crear pagos en nombre de otro usuario.",
    };
  }

  return { ok: true, source: "client", user };
}

/**
 * Operaciones sobre un Stripe Customer: debe coincidir con profiles.stripe_customer_id.
 */
export async function authorizeStripeCustomerAccess(request, customerId) {
  if (!customerId) {
    return { ok: false, status: 400, error: "Falta customer_id" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, error: profileError.message };
  }

  if (profile?.stripe_customer_id !== customerId) {
    return {
      ok: false,
      status: 403,
      error: "No tienes permiso para acceder a este cliente de pago.",
    };
  }

  return { ok: true, user };
}
