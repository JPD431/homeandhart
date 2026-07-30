/**
 * ¿Los dos usuarios ya tienen una reserva conjunta activa/pasada
 * (confirmada | en_curso | completada)? Si sí, el chat puede compartir contacto.
 */

const JOINT_BOOKING_STATES = ["confirmada", "en_curso", "completada"];

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>}
 */
export async function haveJointConfirmedBooking(
  supabaseAdmin,
  userA,
  userB,
) {
  if (!userA || !userB || userA === userB) return false;

  // A es cliente, B es proveedor del servicio
  const { data: asCliente, error: err1 } = await supabaseAdmin
    .from("bookings")
    .select("id, services!inner(proveedor_id)")
    .eq("cliente_id", userA)
    .in("estado", JOINT_BOOKING_STATES)
    .eq("services.proveedor_id", userB)
    .limit(1);

  if (err1) {
    console.error(
      "[chat-booking-gate] Error buscando reserva (A cliente):",
      err1,
    );
  } else if (asCliente?.length) {
    return true;
  }

  // B es cliente, A es proveedor
  const { data: asProveedor, error: err2 } = await supabaseAdmin
    .from("bookings")
    .select("id, services!inner(proveedor_id)")
    .eq("cliente_id", userB)
    .in("estado", JOINT_BOOKING_STATES)
    .eq("services.proveedor_id", userA)
    .limit(1);

  if (err2) {
    console.error(
      "[chat-booking-gate] Error buscando reserva (B cliente):",
      err2,
    );
    return false;
  }

  return Boolean(asProveedor?.length);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>} true = hay que filtrar contacto
 */
export async function shouldFilterContactBetween(
  supabaseAdmin,
  userA,
  userB,
) {
  const joint = await haveJointConfirmedBooking(supabaseAdmin, userA, userB);
  return !joint;
}
