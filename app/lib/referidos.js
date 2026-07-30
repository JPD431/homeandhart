// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reservas_sin_comision_cliente integer DEFAULT 3;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reservas_sin_comision_proveedor integer DEFAULT 3;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS codigo_referido text UNIQUE;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referido_por text;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referidos_count integer DEFAULT 0;

export function normalizeNombreForCodigo(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, "X");
}

export function generateCodigoReferido(nombre) {
  const prefix = normalizeNombreForCodigo(nombre);
  const random = Math.floor(100 + Math.random() * 900);
  return `HH-${prefix}${random}`;
}

export function buildReferralLink(codigo) {
  return `https://homeandheart.es/registro?ref=${encodeURIComponent(codigo)}`;
}

/**
 * ¿El referidor pertenece a la misma familia de la reserva?
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string|null|undefined} familiaId
 * @param {string} referidorId
 */
async function referidorEnMismaFamilia(supabaseAdmin, familiaId, referidorId) {
  if (!familiaId || !referidorId) return false;
  const { data, error } = await supabaseAdmin
    .from("familia_miembros")
    .select("id")
    .eq("familia_id", familiaId)
    .eq("perfil_id", referidorId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) {
    console.error(
      "[referidos] Error comprobando familia del referidor:",
      familiaId,
      referidorId,
      error,
    );
    return false;
  }
  return Boolean(data);
}

/**
 * Premia al referidor cuando el referido COMPLETA una reserva (estado completada).
 * Idempotente vía referido_premiado (update atómico).
 * No premia auto-deal (proveedor = referidor) ni misma familia activa.
 *
 * @param {string} referidoUserId — cliente de la reserva
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{ bookingId: string }} opts — reserva que acaba de pasar a completada
 */
export async function rewardReferidorPrimeraReserva(
  referidoUserId,
  supabaseAdmin,
  opts = {},
) {
  const bookingId =
    typeof opts?.bookingId === "string" ? opts.bookingId.trim() : "";

  try {
    if (!referidoUserId || !bookingId) {
      return { rewarded: false, reason: "missing_args" };
    }

    const { data: referido, error: referidoError } = await supabaseAdmin
      .from("profiles")
      .select("referido_por, referido_premiado")
      .eq("id", referidoUserId)
      .maybeSingle();

    if (referidoError) {
      console.error(
        "[referidos] Error cargando perfil referido:",
        referidoUserId,
        referidoError,
      );
      return { rewarded: false, reason: "referido_error" };
    }

    if (!referido?.referido_por || referido.referido_premiado) {
      return { rewarded: false, reason: "not_eligible" };
    }

    const referidorId = referido.referido_por;

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, cliente_id, service_id, estado, familia_id, services:service_id(proveedor_id)",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error(
        "[referidos] Error cargando booking:",
        bookingId,
        bookingError,
      );
      return { rewarded: false, reason: "booking_error" };
    }

    if (!booking || booking.cliente_id !== referidoUserId) {
      return { rewarded: false, reason: "booking_mismatch" };
    }

    if (booking.estado !== "completada") {
      return { rewarded: false, reason: "not_completed" };
    }

    const proveedorId = booking.services?.proveedor_id || null;
    if (proveedorId && proveedorId === referidorId) {
      // Auto-deal: no premiar; no marcar referido_premiado (una reserva legítima posterior sí podrá).
      console.info(
        "[referidos] Skip premio (auto-deal proveedor=referidor)",
        { referidoUserId, bookingId, referidorId },
      );
      return { rewarded: false, reason: "auto_deal" };
    }

    if (
      await referidorEnMismaFamilia(
        supabaseAdmin,
        booking.familia_id,
        referidorId,
      )
    ) {
      console.info("[referidos] Skip premio (misma familia)", {
        referidoUserId,
        bookingId,
        referidorId,
        familiaId: booking.familia_id,
      });
      return { rewarded: false, reason: "same_familia" };
    }

    const { data: marked, error: markError } = await supabaseAdmin
      .from("profiles")
      .update({ referido_premiado: true })
      .eq("id", referidoUserId)
      .eq("referido_premiado", false)
      .select("referido_por")
      .maybeSingle();

    if (markError) {
      console.error(
        "[referidos] Error marcando referido_premiado:",
        referidoUserId,
        markError,
      );
      return { rewarded: false, reason: "mark_error" };
    }

    if (!marked?.referido_por) {
      return { rewarded: false, reason: "already_marked" };
    }

    const { data: referidor, error: referidorError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, role, reservas_sin_comision_cliente, reservas_sin_comision_proveedor, referidos_count",
      )
      .eq("id", marked.referido_por)
      .maybeSingle();

    if (referidorError || !referidor) {
      console.error(
        "[referidos] Referidor no encontrado:",
        marked.referido_por,
        referidorError,
      );
      return { rewarded: false, reason: "referidor_missing" };
    }

    const updatePayload = {
      referidos_count: (Number(referidor.referidos_count) || 0) + 1,
    };

    if (referidor.role === "proveedor") {
      updatePayload.reservas_sin_comision_proveedor =
        (Number(referidor.reservas_sin_comision_proveedor) || 0) + 1;
    } else {
      updatePayload.reservas_sin_comision_cliente =
        (Number(referidor.reservas_sin_comision_cliente) || 0) + 1;
    }

    const { error: rewardError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", referidor.id);

    if (rewardError) {
      console.error(
        "[referidos] Error actualizando contadores del referidor:",
        referidor.id,
        rewardError,
      );
      return { rewarded: false, reason: "reward_error" };
    }

    return { rewarded: true, referidorId: referidor.id };
  } catch (err) {
    console.error(
      "[referidos] rewardReferidorPrimeraReserva:",
      referidoUserId,
      err,
    );
    return { rewarded: false, reason: "exception" };
  }
}
