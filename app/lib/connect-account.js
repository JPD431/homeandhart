import "server-only";

/**
 * Resolución y validación de cuenta Connect destino en el momento del payout (M7).
 * Usa el stripe_account_id ACTUAL del perfil (no snapshot de la reserva).
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} proveedorId
 * @returns {Promise<{ stripeAccountId: string|null, cobrosActivos: boolean|null, error?: string }>}
 */
export async function loadProveedorStripeAccountId(supabase, proveedorId) {
  if (!proveedorId) {
    return { stripeAccountId: null, cobrosActivos: null, error: "Falta proveedorId" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_account_id, cobros_activos")
    .eq("id", proveedorId)
    .maybeSingle();

  if (error) {
    return {
      stripeAccountId: null,
      cobrosActivos: null,
      error: error.message,
    };
  }

  return {
    stripeAccountId: data?.stripe_account_id || null,
    cobrosActivos: data?.cobros_activos === true,
  };
}

/**
 * Comprueba en Stripe que la cuenta Connect puede recibir transfers/payouts.
 * @param {import("stripe").Stripe} stripe
 * @param {string} stripeAccountId
 * @returns {Promise<{ ok: true, account: object } | { ok: false, reason: string, error: string, account?: object|null }>}
 */
export async function validateConnectAccountForTransfer(stripe, stripeAccountId) {
  if (!stripeAccountId || typeof stripeAccountId !== "string") {
    return {
      ok: false,
      reason: "missing_account_id",
      error: "Proveedor sin stripe_account_id",
      account: null,
    };
  }

  let account;
  try {
    account = await stripe.accounts.retrieve(stripeAccountId);
  } catch (err) {
    const message = err?.message ?? String(err);
    return {
      ok: false,
      reason: "retrieve_failed",
      error: `No se pudo recuperar la cuenta Connect ${stripeAccountId}: ${message}`,
      account: null,
    };
  }

  if (!account?.details_submitted) {
    return {
      ok: false,
      reason: "details_not_submitted",
      error: `Cuenta Connect ${stripeAccountId} sin onboarding completo (details_submitted=false)`,
      account,
    };
  }

  if (!account.payouts_enabled) {
    return {
      ok: false,
      reason: "payouts_disabled",
      error: `Cuenta Connect ${stripeAccountId} no puede recibir payouts (payouts_enabled=false)`,
      account,
    };
  }

  const transfers = account.capabilities?.transfers;
  if (transfers != null && transfers !== "active") {
    return {
      ok: false,
      reason: "transfers_not_active",
      error: `Cuenta Connect ${stripeAccountId} sin capability transfers activa (estado: ${transfers})`,
      account,
    };
  }

  return { ok: true, account };
}

/**
 * Lee la cuenta actual del proveedor en BD y valida en Stripe que puede recibir fondos.
 * @returns {Promise<{ ok: true, stripeAccountId: string, account: object, cobrosActivos: boolean|null } | { ok: false, reason: string, error: string, stripeAccountId: string|null }>}
 */
export async function resolveConnectDestinationForPayout(
  stripe,
  supabase,
  proveedorId,
) {
  const loaded = await loadProveedorStripeAccountId(supabase, proveedorId);
  if (loaded.error) {
    return {
      ok: false,
      reason: "profile_error",
      error: loaded.error,
      stripeAccountId: null,
    };
  }

  if (!loaded.stripeAccountId) {
    return {
      ok: false,
      reason: "missing_account_id",
      error: "Proveedor sin stripe_account_id en BD",
      stripeAccountId: null,
    };
  }

  const validated = await validateConnectAccountForTransfer(
    stripe,
    loaded.stripeAccountId,
  );

  if (!validated.ok) {
    return {
      ok: false,
      reason: validated.reason,
      error: validated.error,
      stripeAccountId: loaded.stripeAccountId,
    };
  }

  return {
    ok: true,
    stripeAccountId: loaded.stripeAccountId,
    account: validated.account,
    cobrosActivos: loaded.cobrosActivos,
  };
}
