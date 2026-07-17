/** Registro auditable de cancelaciones (admin). Service role only. */

import { createClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[cancelaciones]";
const DUPLICATE_CODES = new Set(["23505"]);

let adminClient = null;

function getAdmin() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(LOG_PREFIX, "Faltan credenciales Supabase service role");
    return null;
  }
  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

/**
 * Inserta una cancelación (idempotente por booking_id).
 * No lanza: pensado para try/catch en flujos de cancelación.
 *
 * @param {{
 *   bookingId: string,
 *   usuarioId: string,
 *   rolCancelador: 'cliente' | 'proveedor',
 *   motivo?: string | null,
 * }} params
 */
export async function registrarCancelacion({
  bookingId,
  usuarioId,
  rolCancelador,
  motivo = null,
}) {
  if (!bookingId || !usuarioId) {
    console.error(LOG_PREFIX, "Faltan bookingId o usuarioId", {
      bookingId,
      usuarioId,
    });
    return { ok: false, reason: "missing_fields" };
  }

  if (rolCancelador !== "cliente" && rolCancelador !== "proveedor") {
    console.error(LOG_PREFIX, "rol_cancelador inválido", { rolCancelador });
    return { ok: false, reason: "invalid_rol" };
  }

  const admin = getAdmin();
  if (!admin) return { ok: false, reason: "no_admin_client" };

  const motivoTrim =
    typeof motivo === "string" && motivo.trim().length > 0
      ? motivo.trim().slice(0, 2000)
      : null;

  const { data, error } = await admin
    .from("cancelaciones")
    .insert({
      booking_id: bookingId,
      usuario_id: usuarioId,
      rol_cancelador: rolCancelador,
      motivo: motivoTrim,
      es_fuerza_mayor: false,
      exenta: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (DUPLICATE_CODES.has(error.code)) {
      console.log(LOG_PREFIX, "Duplicado (idempotente OK)", { bookingId });
      return { ok: true, duplicate: true };
    }
    console.error(LOG_PREFIX, "Error insertando:", error.message, {
      bookingId,
      usuarioId,
      rolCancelador,
    });
    return { ok: false, reason: "insert_error", error };
  }

  return { ok: true, id: data?.id ?? null };
}

/**
 * Contador de cancelaciones no exentas por usuario.
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
export async function countCancelacionesNoExentas(usuarioId) {
  if (!usuarioId) return 0;
  const admin = getAdmin();
  if (!admin) return 0;

  const { count, error } = await admin
    .from("cancelaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("exenta", false);

  if (error) {
    console.error(LOG_PREFIX, "Error contando:", error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Mapa usuario_id → nº cancelaciones no exentas.
 * @param {string[]} usuarioIds
 * @returns {Promise<Record<string, number>>}
 */
export async function countCancelacionesNoExentasByUsers(usuarioIds) {
  const map = {};
  if (!usuarioIds?.length) return map;

  const admin = getAdmin();
  if (!admin) return map;

  const { data, error } = await admin
    .from("cancelaciones")
    .select("usuario_id")
    .in("usuario_id", usuarioIds)
    .eq("exenta", false);

  if (error) {
    console.error(LOG_PREFIX, "Error agregando contadores:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.usuario_id;
    if (!id) continue;
    map[id] = (map[id] || 0) + 1;
  }

  return map;
}
