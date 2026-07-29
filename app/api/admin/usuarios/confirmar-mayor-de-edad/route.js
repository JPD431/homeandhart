import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { hasDniUploaded } from "@/app/lib/dni";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/admin/usuarios/confirmar-mayor-de-edad
 * Confirma 18+ sin cambiar dni_estado (casos legacy: DNI ya verificado, flag pendiente).
 * Body: { userId: string }
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
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, doc_dni_url, dni_estado, mayor_de_edad_confirmada, role",
    )
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
      { error: "El usuario no tiene DNI subido. Ábrelo y confírmalo al verificar." },
      { status: 400 },
    );
  }

  if (profile.dni_estado !== "verificado") {
    return NextResponse.json(
      {
        error:
          "Primero verifica el DNI (marcando también la mayoría de edad). Este atajo solo aplica si el DNI ya está verificado.",
        code: "dni_no_verificado",
      },
      { status: 400 },
    );
  }

  if (profile.mayor_de_edad_confirmada === true) {
    return NextResponse.json({
      ok: true,
      already_confirmed: true,
      mayor_de_edad_confirmada: true,
    });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      mayor_de_edad_confirmada: true,
      mayor_de_edad_confirmada_at: now,
      mayor_de_edad_confirmada_por: admin.id,
    })
    .eq("id", userId)
    .select(
      "id, mayor_de_edad_confirmada, mayor_de_edad_confirmada_at, mayor_de_edad_confirmada_por",
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mayor_de_edad_confirmada: true,
    profile: updated,
  });
}
