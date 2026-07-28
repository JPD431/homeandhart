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
