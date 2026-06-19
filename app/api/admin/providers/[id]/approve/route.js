import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sendProveedorVerificadoEmail(userId, nombre) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  try {
    await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "proveedor_verificado",
        user_id: userId,
        nombre,
      }),
    });
  } catch (err) {
    console.error("[approve] Error enviando email proveedor_verificado:", err);
  }
}

export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: proveedor, error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ verificado: true, rechazado: false })
    .eq("id", id)
    .select("nombre")
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: servicesError } = await supabaseAdmin
    .from("services")
    .update({ disponible: true })
    .eq("proveedor_id", id);

  if (servicesError) {
    console.error(
      "[approve] No se pudieron activar los servicios del proveedor:",
      servicesError,
    );
  }

  if (proveedor) {
    await sendProveedorVerificadoEmail(id, proveedor.nombre);
  }

  return NextResponse.json({ ok: true });
}
