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
 * Premia al referidor cuando el referido completa su primera reserva.
 * Idempotente vía referido_premiado (update atómico).
 */
export async function rewardReferidorPrimeraReserva(referidoUserId, supabaseAdmin) {
  try {
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
      return;
    }

    if (!referido?.referido_por || referido.referido_premiado) {
      return;
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
      return;
    }

    if (!marked?.referido_por) {
      return;
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
      return;
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
    }
  } catch (err) {
    console.error(
      "[referidos] rewardReferidorPrimeraReserva:",
      referidoUserId,
      err,
    );
  }
}
