import "server-only";

/**
 * Débito atómico de crédito vía RPC Postgres (F3).
 * Idempotente por idempotencyKey: reintento devuelve el mismo amount sin re-debitar.
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {number} maxAmount tope a debitar (p.ej. 60% del total)
 * @param {string} idempotencyKey p.ej. complete:grupo:... o complete:pi:...
 * @returns {Promise<number>} crédito realmente debitado (>= 0)
 */
export async function debitCreditoDisponible(
  supabaseAdmin,
  userId,
  maxAmount,
  idempotencyKey,
) {
  const max = Math.round(Number(maxAmount) * 100) / 100;
  if (!userId || !idempotencyKey || !(max > 0)) {
    return 0;
  }

  const { data, error } = await supabaseAdmin.rpc("debit_credito_disponible", {
    p_user_id: userId,
    p_max_amount: max,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(error.message || "Error al debitar crédito");
  }

  return Math.round(Number(data) * 100) / 100 || 0;
}

/**
 * Revierte un débito previo (si el complete falla tras debitar).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} idempotencyKey
 */
export async function releaseCreditoDebito(supabaseAdmin, idempotencyKey) {
  if (!idempotencyKey) return 0;

  const { data, error } = await supabaseAdmin.rpc("release_credito_debito", {
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error(
      "[credito-debito] Error liberando débito:",
      error.message,
      { idempotencyKey },
    );
    throw new Error(error.message || "Error al liberar crédito");
  }

  return Math.round(Number(data) * 100) / 100 || 0;
}

/**
 * Abono atómico de crédito vía RPC (F4 cancelaciones / reembolsos).
 * Idempotente por idempotencyKey: reintento devuelve el mismo amount sin re-abonar.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {number} amount
 * @param {string} idempotencyKey p.ej. credit:cancel-cliente:${bookingId}
 * @returns {Promise<number>} crédito realmente abonado (o el previo si ya existía la key)
 */
export async function creditCreditoDisponible(
  supabaseAdmin,
  userId,
  amount,
  idempotencyKey,
) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!userId || !idempotencyKey || !(value > 0)) {
    return 0;
  }

  const { data, error } = await supabaseAdmin.rpc("credit_credito_disponible", {
    p_user_id: userId,
    p_amount: value,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(error.message || "Error al abonar crédito");
  }

  return Math.round(Number(data) * 100) / 100 || 0;
}
