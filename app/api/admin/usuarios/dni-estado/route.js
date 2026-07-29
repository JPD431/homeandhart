import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { hasDniUploaded } from "@/app/lib/dni";
import { resolveDniPendienteNotifications } from "@/app/lib/dni-admin-notify";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS_VALIDOS = new Set(["verificado", "rechazado"]);

/**
 * POST /api/admin/usuarios/dni-estado
 * Body: {
 *   userId: string,
 *   estado: 'verificado' | 'rechazado',
 *   confirmar_mayor_de_edad?: boolean  // obligatorio true si estado === 'verificado'
 * }
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

  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
  const confirmarMayorDeEdad = body?.confirmar_mayor_de_edad === true;

  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  if (!ESTADOS_VALIDOS.has(estado)) {
    return NextResponse.json(
      { error: "estado debe ser 'verificado' o 'rechazado'" },
      { status: 400 },
    );
  }

  if (estado === "verificado" && !confirmarMayorDeEdad) {
    return NextResponse.json(
      {
        error:
          "Debes confirmar la mayoría de edad (18+) según el DNI antes de verificar el documento",
        code: "mayor_de_edad_requerida",
      },
      { status: 400 },
    );
  }

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, doc_dni_url, dni_estado")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!hasDniUploaded(profile)) {
    return NextResponse.json(
      { error: "El usuario no tiene DNI subido" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const updatePayload =
    estado === "verificado"
      ? {
          dni_estado: "verificado",
          dni_verificado_at: now,
          dni_verificado_por: admin.id,
          mayor_de_edad_confirmada: true,
          mayor_de_edad_confirmada_at: now,
          mayor_de_edad_confirmada_por: admin.id,
        }
      : {
          // Rechazo: no tocar el flag de mayoría de edad.
          dni_estado: "rechazado",
          dni_verificado_at: now,
          dni_verificado_por: admin.id,
        };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select(
      "id, dni_estado, dni_verificado_at, dni_verificado_por, mayor_de_edad_confirmada, mayor_de_edad_confirmada_at, mayor_de_edad_confirmada_por",
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await resolveDniPendienteNotifications(userId);
  } catch (err) {
    console.error("[dni-estado] resolve notificaciones:", err?.message || err);
  }

  return NextResponse.json({ ok: true, profile: updated });
}
