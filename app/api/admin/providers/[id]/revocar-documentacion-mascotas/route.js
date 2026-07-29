import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Admin revoca la aprobación de documentación de mascotas y pausa servicios vertical=mascotas.
 * No toca otras verticales.
 */
export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, mascotas_documentacion_aprobada")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || profile.role !== "proveedor") {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      mascotas_documentacion_aprobada: false,
      mascotas_documentacion_aprobada_at: null,
      mascotas_documentacion_aprobada_por: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: paused, error: pauseError } = await supabaseAdmin
    .from("services")
    .update({ disponible: false })
    .eq("proveedor_id", id)
    .eq("vertical", "mascotas")
    .eq("disponible", true)
    .select("id");

  if (pauseError) {
    console.error(
      "[revocar-documentacion-mascotas] No se pudieron pausar servicios mascotas:",
      pauseError,
    );
    return NextResponse.json(
      {
        error:
          "Flag revocado, pero no se pudieron pausar los servicios de mascotas: " +
          pauseError.message,
        mascotas_documentacion_aprobada: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mascotas_documentacion_aprobada: false,
    servicios_mascotas_pausados: (paused ?? []).length,
    revocado_por: admin.id,
  });
}
