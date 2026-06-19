import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: perfil, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("penalizacion_valoracion")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!perfil) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const penalizacion = (Number(perfil.penalizacion_valoracion) || 0) + 0.5;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ penalizacion_valoracion: penalizacion })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, penalizacion });
}
