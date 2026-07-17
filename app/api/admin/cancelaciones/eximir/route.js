import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/admin/cancelaciones/eximir
 * Body: { cancelacionId: string, nota?: string }
 * Marca la cancelación como fuerza mayor / exenta (deja de contar).
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

  const cancelacionId =
    typeof body?.cancelacionId === "string" ? body.cancelacionId.trim() : "";
  const nota =
    typeof body?.nota === "string" && body.nota.trim().length > 0
      ? body.nota.trim().slice(0, 2000)
      : null;

  if (!cancelacionId) {
    return NextResponse.json({ error: "Falta cancelacionId" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cancelaciones")
    .select("id, exenta, usuario_id, booking_id")
    .eq("id", cancelacionId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Cancelación no encontrada" },
      { status: 404 },
    );
  }

  if (existing.exenta === true) {
    return NextResponse.json({
      ok: true,
      already_exenta: true,
      cancelacion: existing,
    });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("cancelaciones")
    .update({
      exenta: true,
      es_fuerza_mayor: true,
      exenta_por: admin.id,
      exenta_at: new Date().toISOString(),
      ...(nota ? { nota_admin: nota } : {}),
    })
    .eq("id", cancelacionId)
    .eq("exenta", false)
    .select(
      "id, booking_id, usuario_id, exenta, es_fuerza_mayor, exenta_por, exenta_at, nota_admin",
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cancelacion: updated });
}
