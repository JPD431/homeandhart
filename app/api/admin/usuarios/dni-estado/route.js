import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { hasDniUploaded } from "@/app/lib/dni";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS_VALIDOS = new Set(["verificado", "rechazado"]);

/**
 * POST /api/admin/usuarios/dni-estado
 * Body: { userId: string, estado: 'verificado' | 'rechazado' }
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

  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  if (!ESTADOS_VALIDOS.has(estado)) {
    return NextResponse.json(
      { error: "estado debe ser 'verificado' o 'rechazado'" },
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

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      dni_estado: estado,
      dni_verificado_at: new Date().toISOString(),
      dni_verificado_por: admin.id,
    })
    .eq("id", userId)
    .select("id, dni_estado, dni_verificado_at, dni_verificado_por")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: updated });
}
