import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  MODALIDAD_COBRO_VALUES,
  modalidadCobroNeedsHoras,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function assertOwner(serviceId, userId) {
  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id, vertical")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!service) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 }),
    };
  }
  if (service.proveedor_id !== userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { ok: true, service };
}

function normalizeIncomingRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    return { ok: false, error: "Falta el listado de modalidades" };
  }

  const seen = new Set();
  const rows = [];

  for (const item of rawRows) {
    const modalidad = item?.modalidad;
    if (!MODALIDAD_COBRO_VALUES.includes(modalidad)) {
      return { ok: false, error: "Modalidad no válida" };
    }
    if (seen.has(modalidad)) {
      return { ok: false, error: "Modalidad duplicada" };
    }
    seen.add(modalidad);

    const precio = Number(item.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      return { ok: false, error: "Cada modalidad activa necesita un precio > 0" };
    }

    let horas_unidad = null;
    if (modalidadCobroNeedsHoras(modalidad)) {
      const h = Number(item.horas_unidad);
      if (!Number.isFinite(h) || h <= 0 || h > 24) {
        return {
          ok: false,
          error: "Indica horas válidas (mayor que 0 y ≤ 24) para día / medio día",
        };
      }
      horas_unidad = h;
    }

    let suplemento_extra = null;
    if (item.suplemento_extra != null && item.suplemento_extra !== "") {
      const s = Number(item.suplemento_extra);
      if (!Number.isFinite(s) || s < 0) {
        return { ok: false, error: "El suplemento no puede ser negativo" };
      }
      if (s > 0) suplemento_extra = s;
    }

    rows.push({ modalidad, precio, horas_unidad, suplemento_extra });
  }

  if (rows.length === 0) {
    return { ok: false, error: "Activa al menos una modalidad de cobro" };
  }

  return { ok: true, rows };
}

/**
 * GET /api/services/[serviceId]/modalidades
 */
export async function GET(_request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ownership = await assertOwner(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  const { data, error } = await supabaseAdmin
    .from("service_modalidades")
    .select("modalidad, precio, horas_unidad, suplemento_extra")
    .eq("service_id", serviceId)
    .order("modalidad", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modalidades: data ?? [] });
}

/**
 * PUT /api/services/[serviceId]/modalidades
 * Body: { modalidades: [{ modalidad, precio, horas_unidad?, suplemento_extra? }] }
 * Reemplaza el set completo (delete + insert). Array vacío no permitido.
 */
export async function PUT(request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ownership = await assertOwner(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  if (!supportsModalidadCobro(ownership.service.vertical)) {
    return NextResponse.json(
      { error: "Este servicio no admite modalidades de cobro" },
      { status: 400 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const normalized = normalizeIncomingRows(body?.modalidades);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const { error: delError } = await supabaseAdmin
    .from("service_modalidades")
    .delete()
    .eq("service_id", serviceId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const payload = normalized.rows.map((row) => ({
    service_id: serviceId,
    ...row,
    updated_at: new Date().toISOString(),
  }));

  const { data, error: insError } = await supabaseAdmin
    .from("service_modalidades")
    .insert(payload)
    .select("modalidad, precio, horas_unidad, suplemento_extra");

  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ modalidades: data ?? [] });
}
