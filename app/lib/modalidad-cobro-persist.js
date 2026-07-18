import {
  parseModalidadesCobroFromRows,
  serializeModalidadesCobroRows,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

/**
 * Persiste modalidades vía API (reemplazo completo).
 */
export async function saveServiceModalidades(serviceId, details, vertical) {
  if (!serviceId || !supportsModalidadCobro(vertical)) {
    return { ok: true, skipped: true };
  }

  const serialized = serializeModalidadesCobroRows(details, vertical);
  if (!serialized.ok) {
    return { ok: false, error: serialized.error };
  }

  const res = await fetch(`/api/services/${serviceId}/modalidades`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modalidades: serialized.rows }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "No se pudieron guardar las modalidades",
    };
  }
  return { ok: true, modalidades: data.modalidades ?? [] };
}

/**
 * Carga modalidades del servicio (dueño autenticado).
 */
export async function loadServiceModalidadesForm(
  serviceId,
  vertical,
  legacyRow,
) {
  if (!serviceId || !supportsModalidadCobro(vertical)) {
    return parseModalidadesCobroFromRows(vertical, [], legacyRow);
  }

  const res = await fetch(`/api/services/${serviceId}/modalidades`);
  if (!res.ok) {
    return parseModalidadesCobroFromRows(vertical, [], legacyRow);
  }
  const data = await res.json().catch(() => ({}));
  return parseModalidadesCobroFromRows(
    vertical,
    data.modalidades ?? [],
    legacyRow,
  );
}

/**
 * Carga modalidades en lote para varios servicios (dueño).
 */
export async function loadModalidadesForServices(serviceRows) {
  const rows = Array.isArray(serviceRows) ? serviceRows : [];
  const result = new Map();

  await Promise.all(
    rows.map(async (row) => {
      if (!row?.id || !supportsModalidadCobro(row.vertical)) return;
      const parsed = await loadServiceModalidadesForm(row.id, row.vertical, row);
      result.set(row.id, parsed);
    }),
  );

  return result;
}
