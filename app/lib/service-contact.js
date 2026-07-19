/**
 * Contacto/ubicación exacta del servicio (tabla service_contact).
 *
 * Los campos direccion_exacta, telefono_contacto, location_lat, location_lng
 * viven SOLO aquí — ya no existen en services.
 *
 * Regla si no aplica dirección (needsDireccionFields=false o todo vacío):
 *   BORRAR la fila de service_contact (no dejar nulls huérfanos).
 */

import { createClient } from "@supabase/supabase-js";
import { supabase as browserSupabase } from "@/app/lib/supabase";

export const SERVICE_CONTACT_SELECT =
  "service_id, direccion_exacta, telefono_contacto, location_lat, location_lng, updated_at";

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

export function emptyContactFields() {
  return {
    direccion_exacta: null,
    telefono_contacto: null,
    location_lat: null,
    location_lng: null,
  };
}

export function normalizeContactFields(fields = {}) {
  return {
    direccion_exacta:
      typeof fields.direccion_exacta === "string"
        ? fields.direccion_exacta.trim() || null
        : fields.direccion_exacta ?? null,
    telefono_contacto:
      typeof fields.telefono_contacto === "string"
        ? fields.telefono_contacto.trim() || null
        : fields.telefono_contacto ?? null,
    location_lat:
      fields.location_lat != null && Number.isFinite(Number(fields.location_lat))
        ? Number(fields.location_lat)
        : null,
    location_lng:
      fields.location_lng != null && Number.isFinite(Number(fields.location_lng))
        ? Number(fields.location_lng)
        : null,
  };
}

/** ¿Hay algún dato de contacto/ubicación que merezca una fila? */
export function hasAnyContactData(fields) {
  const n = normalizeContactFields(fields);
  return !!(
    n.direccion_exacta ||
    n.telefono_contacto ||
    n.location_lat != null ||
    n.location_lng != null
  );
}

/**
 * Campos desde service_contact (o, opcionalmente, estado en memoria del formulario).
 * NO leer de services — esas columnas ya no existen.
 * @param {object|null|undefined} contact — fila service_contact
 * @param {object|null|undefined} formFallback — details del formulario (opcional)
 */
export function resolveContactFields(contact, formFallback = null) {
  const c = contact || null;
  const f = formFallback || {};
  return {
    direccion_exacta: c?.direccion_exacta ?? f.direccion_exacta ?? null,
    telefono_contacto: c?.telefono_contacto ?? f.telefono_contacto ?? null,
    location_lat: c?.location_lat ?? f.location_lat ?? null,
    location_lng: c?.location_lng ?? f.location_lng ?? null,
  };
}

/** Fusiona contacto de service_contact en un objeto servicio (mutación superficial). */
export function mergeResolvedContactIntoService(service, contact) {
  if (!service) return service;
  const resolved = resolveContactFields(contact);
  return { ...service, ...resolved };
}

function pickClient(client) {
  return client || browserSupabase;
}

/**
 * Upsert o delete según haya datos.
 * Regla: sin datos → DELETE; con datos → UPSERT.
 * @returns {Promise<{ ok: boolean, error?: string, action?: 'upsert'|'delete'|'noop' }>}
 */
export async function syncServiceContact(serviceId, fields, client = null) {
  if (!serviceId) return { ok: false, error: "Falta serviceId" };
  const sb = pickClient(client);
  const normalized = normalizeContactFields(fields);

  if (!hasAnyContactData(normalized)) {
    const { error } = await sb
      .from("service_contact")
      .delete()
      .eq("service_id", serviceId);
    if (error) {
      console.error("[service_contact] delete", error.message);
      return { ok: false, error: error.message, action: "delete" };
    }
    return { ok: true, action: "delete" };
  }

  const { error } = await sb.from("service_contact").upsert(
    {
      service_id: serviceId,
      ...normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service_id" },
  );

  if (error) {
    console.error("[service_contact] upsert", error.message);
    return { ok: false, error: error.message, action: "upsert" };
  }
  return { ok: true, action: "upsert" };
}

/** Lectura de una fila (cliente autenticado o el client pasado). */
export async function loadServiceContact(serviceId, client = null) {
  if (!serviceId) return null;
  const sb = pickClient(client);
  const { data, error } = await sb
    .from("service_contact")
    .select(SERVICE_CONTACT_SELECT)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (error) {
    console.error("[service_contact] load", error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Carga varias filas → Map<serviceId, row>
 * @param {string[]} serviceIds
 */
export async function loadServiceContactsByIds(serviceIds, client = null) {
  const ids = [...new Set((serviceIds || []).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;

  const sb = pickClient(client);
  const { data, error } = await sb
    .from("service_contact")
    .select(SERVICE_CONTACT_SELECT)
    .in("service_id", ids);

  if (error) {
    console.error("[service_contact] loadByIds", error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.service_id, row);
  }
  return map;
}

/** Aplica contacto de service_contact a details de formulario. */
export function applyContactToDetails(details, contact) {
  const resolved = resolveContactFields(contact);
  return {
    ...details,
    direccion_exacta: resolved.direccion_exacta || "",
    telefono_contacto: resolved.telefono_contacto || "",
    location_lat: resolved.location_lat,
    location_lng: resolved.location_lng,
  };
}

// —— Service role (server) ——

export async function syncServiceContactAdmin(serviceId, fields) {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Sin service role" };
  return syncServiceContact(serviceId, fields, admin);
}

export async function loadServiceContactAdmin(serviceId) {
  const admin = getAdminClient();
  if (!admin) return null;
  return loadServiceContact(serviceId, admin);
}

export async function loadServiceContactsByIdsAdmin(serviceIds) {
  const admin = getAdminClient();
  if (!admin) return new Map();
  return loadServiceContactsByIds(serviceIds, admin);
}

/**
 * Adjunta campos de contacto resueltos a servicios (admin).
 * @param {object[]} services
 */
export async function attachContactsToServicesAdmin(services) {
  const list = Array.isArray(services) ? services : [];
  if (list.length === 0) return list;
  const map = await loadServiceContactsByIdsAdmin(list.map((s) => s.id));
  return list.map((svc) =>
    mergeResolvedContactIntoService(svc, map.get(svc.id) ?? null),
  );
}

export async function attachContactToServiceAdmin(service) {
  if (!service?.id) return service;
  const contact = await loadServiceContactAdmin(service.id);
  return mergeResolvedContactIntoService(service, contact);
}
