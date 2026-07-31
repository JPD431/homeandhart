/**
 * Reservas que bloquean el borrado de cuenta (cliente o proveedor).
 */

const ESTADOS_ACTIVOS = ["pendiente", "confirmada", "en_curso"];

const ESTADOS_CANCELADOS = [
  "cancelada",
  "cancelada_proveedor",
  "cancelada_garantia",
  "rechazada",
];

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countActiveBookingsBlockingDelete(supabaseAdmin, userId) {
  const { data: asCliente, error: e1 } = await supabaseAdmin
    .from("bookings")
    .select("id, estado, pago_liberado_at")
    .eq("cliente_id", userId);

  if (e1) throw e1;

  const { data: providerServices, error: e2 } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("proveedor_id", userId);

  if (e2) throw e2;

  const serviceIds = (providerServices || []).map((s) => s.id);
  let asProveedor = [];

  if (serviceIds.length > 0) {
    const { data, error: e3 } = await supabaseAdmin
      .from("bookings")
      .select("id, estado, pago_liberado_at")
      .in("service_id", serviceIds);
    if (e3) throw e3;
    asProveedor = data || [];
  }

  const seen = new Set();
  let count = 0;

  for (const b of [...(asCliente || []), ...asProveedor]) {
    if (!b?.id || seen.has(b.id)) continue;
    if (!isBlockingBooking(b)) continue;
    seen.add(b.id);
    count += 1;
  }

  return count;
}

function isBlockingBooking(b) {
  if (ESTADOS_ACTIVOS.includes(b.estado)) return true;
  if (
    b.pago_liberado_at == null &&
    !ESTADOS_CANCELADOS.includes(b.estado)
  ) {
    return true;
  }
  return false;
}
