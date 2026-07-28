import "server-only";

/**
 * Claim atómico de cupo "reserva sin comisión" (M10).
 * Idempotente por key: reintento devuelve el mismo boolean sin re-decrementar.
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {'cliente'|'proveedor'} role
 * @param {string} idempotencyKey
 * @returns {Promise<boolean>} true si se aplicó la exención (contador decrementado)
 */
export async function claimReservaSinComision(
  supabaseAdmin,
  userId,
  role,
  idempotencyKey,
) {
  if (!userId || !idempotencyKey || (role !== "cliente" && role !== "proveedor")) {
    return false;
  }

  const { data, error } = await supabaseAdmin.rpc("claim_reserva_sin_comision", {
    p_user_id: userId,
    p_role: role,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(error.message || "Error al reclamar reserva sin comisión");
  }

  return data === true;
}

/**
 * Revierte un claim previo (restaura contador si se había decrementado).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} idempotencyKey
 */
export async function releaseReservaSinComision(supabaseAdmin, idempotencyKey) {
  if (!idempotencyKey) return false;

  const { data, error } = await supabaseAdmin.rpc(
    "release_reserva_sin_comision",
    { p_idempotency_key: idempotencyKey },
  );

  if (error) {
    console.error(
      "[sin-comision] Error liberando claim:",
      error.message,
      { idempotencyKey },
    );
    throw new Error(error.message || "Error al liberar reserva sin comisión");
  }

  return data === true;
}
