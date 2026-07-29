import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import { normalizeNru } from "@/app/lib/nru";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS = new Set(["verificado", "rechazado"]);

async function notifyProveedorNru(userId, nombre, estado, titulo) {
  if (isExcludedFromUserEmailSequences(userId)) return;
  try {
    const result = await sendPlatformEmail({
      tipo:
        estado === "verificado" ? "nru_verificado" : "nru_rechazado",
      user_id: userId,
      nombre,
      titulo,
    });
    if (!result.ok) {
      console.error(
        "[nru-estado] email:",
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[nru-estado] email:", err);
  }
}

/**
 * POST /api/admin/services/[id]/nru-estado
 * Body: { estado: 'verificado' | 'rechazado' }
 */
export async function POST(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta service id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const estado = body?.estado;
  if (!ESTADOS.has(estado)) {
    return NextResponse.json(
      { error: "estado debe ser 'verificado' o 'rechazado'" },
      { status: 400 },
    );
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select(
      "id, vertical, titulo, nru, nru_estado, proveedor_id, profiles!proveedor_id(id, nombre)",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  if (service.vertical !== "alojamiento") {
    return NextResponse.json(
      { error: "Solo aplica a servicios de alojamiento" },
      { status: 400 },
    );
  }

  const nru = normalizeNru(service.nru);
  if (estado === "verificado" && !nru) {
    return NextResponse.json(
      {
        error: "El servicio no tiene NRU declarado",
        code: "nru_vacio",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const update =
    estado === "verificado"
      ? {
          nru_estado: "verificado",
          nru_aprobado_at: now,
          nru_aprobado_por: admin.id,
        }
      : {
          nru_estado: "rechazado",
          nru_aprobado_at: null,
          nru_aprobado_por: null,
          disponible: false,
        };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("services")
    .update(update)
    .eq("id", serviceId)
    .select("id, nru, nru_estado, nru_aprobado_at, nru_aprobado_por, disponible")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const profile = service.profiles;
  const nombre = profile?.nombre || "proveedor";
  await notifyProveedorNru(
    service.proveedor_id,
    nombre,
    estado,
    service.titulo || "Tu alojamiento",
  );

  return NextResponse.json({
    ok: true,
    service: updated,
  });
}
