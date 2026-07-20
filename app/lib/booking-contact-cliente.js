/**
 * Dirección del cliente por reserva (tabla booking_contact_cliente).
 * Dato personal: RLS — cliente dueño ALL; proveedor SELECT solo
 * confirmada/en_curso/completada; anon denegado.
 */

import { createClient } from "@supabase/supabase-js";
import { supabase as browserSupabase } from "@/app/lib/supabase";

export const BOOKING_CONTACT_CLIENTE_SELECT =
  "booking_id, direccion_cliente, updated_at";

function getAdminClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Upsert o delete según haya dirección.
 * Si a_definir o sin texto → borra la fila (no dejar nulls huérfanos).
 *
 * @param {string} bookingId
 * @param {{ direccion_cliente?: string | null, a_definir?: boolean }} fields
 * @param {import("@supabase/supabase-js").SupabaseClient | null} [adminClient]
 */
export async function syncBookingContactCliente(
  bookingId,
  fields = {},
  adminClient = null,
) {
  if (!bookingId) return { ok: false, error: "booking_id requerido" };

  const sb = adminClient || getAdminClient();
  if (!sb) return { ok: false, error: "Admin client no disponible" };

  const direccion =
    typeof fields.direccion_cliente === "string"
      ? fields.direccion_cliente.trim() || null
      : fields.direccion_cliente ?? null;
  const aDefinir = fields.a_definir === true || !direccion;

  if (aDefinir) {
    const { error } = await sb
      .from("booking_contact_cliente")
      .delete()
      .eq("booking_id", bookingId);
    if (error) {
      console.error("[booking_contact_cliente] delete", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, deleted: true };
  }

  const { error } = await sb.from("booking_contact_cliente").upsert(
    {
      booking_id: bookingId,
      direccion_cliente: direccion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "booking_id" },
  );

  if (error) {
    console.error("[booking_contact_cliente] upsert", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, deleted: false };
}

/**
 * Lectura autenticada (RLS aplica).
 * @param {string} bookingId
 * @param {import("@supabase/supabase-js").SupabaseClient} [client]
 */
export async function loadBookingContactCliente(bookingId, client = browserSupabase) {
  if (!bookingId) return null;
  const { data, error } = await client
    .from("booking_contact_cliente")
    .select(BOOKING_CONTACT_CLIENTE_SELECT)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) {
    console.error("[booking_contact_cliente] load", error.message);
    return null;
  }
  return data;
}

/**
 * @param {string[]} bookingIds
 * @param {import("@supabase/supabase-js").SupabaseClient} [client]
 * @returns {Promise<Map<string, { booking_id: string, direccion_cliente: string | null }>>}
 */
export async function loadBookingContactsClienteByIds(
  bookingIds,
  client = browserSupabase,
) {
  const map = new Map();
  const ids = [...new Set((bookingIds || []).filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await client
    .from("booking_contact_cliente")
    .select(BOOKING_CONTACT_CLIENTE_SELECT)
    .in("booking_id", ids);

  if (error) {
    console.error("[booking_contact_cliente] loadByIds", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.booking_id, row);
  }
  return map;
}

/**
 * Admin (emails / complete).
 */
export async function loadBookingContactClienteAdmin(bookingId, adminClient = null) {
  const sb = adminClient || getAdminClient();
  if (!sb || !bookingId) return null;
  const { data, error } = await sb
    .from("booking_contact_cliente")
    .select(BOOKING_CONTACT_CLIENTE_SELECT)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) {
    console.error("[booking_contact_cliente] loadAdmin", error.message);
    return null;
  }
  return data;
}
