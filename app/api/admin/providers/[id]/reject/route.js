import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { REVISION_RECHAZADO } from "@/app/lib/onboarding-persist";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json({ error: "Falta motivo" }, { status: 400 });
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      verificado: false,
      rechazado: true,
      motivo_rechazo: motivo,
    })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: servicesError } = await supabaseAdmin
    .from("services")
    .update({ disponible: false, revision_estado: REVISION_RECHAZADO })
    .eq("proveedor_id", id);

  if (servicesError) {
    console.error(
      "[reject] No se pudieron desactivar los servicios del proveedor:",
      servicesError,
    );
  }

  return NextResponse.json({ ok: true });
}
