import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import {
  REVISION_APROBADO,
  REVISION_EN_REVISION,
  REVISION_RECHAZADO,
} from "@/app/lib/onboarding-persist";
import {
  notifyProveedorServicioRevision,
  resolveServicioPendienteNotifications,
} from "@/app/lib/service-revision-notify";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * GET /api/admin/servicios/revision
 * Lista todos los servicios con revision_estado = en_revision.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("services")
    .select(
      "id, titulo, vertical, precio, ciudad, location_zone, created_at, proveedor_id, revision_estado, disponible, nru, nru_estado, profiles!proveedor_id(id, nombre, apellido, verificado, cobros_activos, ciudad)",
    )
    .eq("revision_estado", REVISION_EN_REVISION)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const servicios = (data ?? []).map((row) => {
    const profile = row.profiles || {};
    return {
      id: row.id,
      titulo: row.titulo,
      vertical: row.vertical,
      precio: row.precio,
      ciudad: row.ciudad || row.location_zone || profile.ciudad || null,
      created_at: row.created_at,
      proveedor_id: row.proveedor_id,
      revision_estado: row.revision_estado,
      disponible: row.disponible,
      nru: row.nru || null,
      nru_estado: row.nru_estado || "pendiente",
      proveedor_nombre: [profile.nombre, profile.apellido]
        .filter(Boolean)
        .join(" ")
        .trim() || "Sin nombre",
      proveedor_verificado: profile.verificado === true,
      cobros_activos: profile.cobros_activos === true,
    };
  });

  return NextResponse.json({
    servicios,
    meta: { pendientes: servicios.length },
  });
}

/**
 * POST /api/admin/servicios/revision
 * Body: { service_id, accion: 'aprobar'|'rechazar', motivo?: string }
 */
export async function POST(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const serviceId =
    typeof body?.service_id === "string" ? body.service_id.trim() : "";
  const accion = body?.accion === "aprobar" || body?.accion === "rechazar"
    ? body.accion
    : null;
  const motivo =
    typeof body?.motivo === "string" ? body.motivo.trim() : "";

  if (!serviceId || !accion) {
    return NextResponse.json(
      { error: "Faltan service_id o accion (aprobar|rechazar)" },
      { status: 400 },
    );
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("services")
    .select(
      "id, proveedor_id, revision_estado, titulo, profiles!proveedor_id(verificado, cobros_activos)",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  if (existing.revision_estado !== REVISION_EN_REVISION) {
    return NextResponse.json(
      { error: "El servicio no está en revisión" },
      { status: 409 },
    );
  }

  if (accion === "aprobar") {
    const cobrosActivos = existing.profiles?.cobros_activos === true;
    const update = {
      revision_estado: REVISION_APROBADO,
      disponible: cobrosActivos,
    };

    const { error: updateError } = await supabaseAdmin
      .from("services")
      .update(update)
      .eq("id", serviceId)
      .eq("revision_estado", REVISION_EN_REVISION);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    try {
      await resolveServicioPendienteNotifications(serviceId);
    } catch (err) {
      console.error("[servicios/revision] resolve notif:", err?.message || err);
    }

    try {
      await notifyProveedorServicioRevision({
        serviceId,
        accion: "aprobar",
      });
    } catch (err) {
      console.error("[servicios/revision] notify proveedor:", err?.message || err);
    }

    return NextResponse.json({
      ok: true,
      revision_estado: REVISION_APROBADO,
      disponible: cobrosActivos,
    });
  }

  // rechazar
  const { error: rejectError } = await supabaseAdmin
    .from("services")
    .update({
      revision_estado: REVISION_RECHAZADO,
      disponible: false,
    })
    .eq("id", serviceId)
    .eq("revision_estado", REVISION_EN_REVISION);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 500 });
  }

  try {
    await resolveServicioPendienteNotifications(serviceId);
  } catch (err) {
    console.error("[servicios/revision] resolve notif:", err?.message || err);
  }

  try {
    await notifyProveedorServicioRevision({
      serviceId,
      accion: "rechazar",
      motivo,
    });
  } catch (err) {
    console.error("[servicios/revision] notify proveedor:", err?.message || err);
  }

  return NextResponse.json({
    ok: true,
    revision_estado: REVISION_RECHAZADO,
    disponible: false,
  });
}
