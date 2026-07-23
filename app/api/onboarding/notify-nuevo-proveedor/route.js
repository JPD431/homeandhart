import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import { resolverNombreUsuario } from "@/app/lib/email-usuario";

/**
 * Notifica a la plataforma un nuevo onboarding de proveedor.
 * Solo el propio usuario; email forzado al de la sesión.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene email" },
      { status: 400 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const verticales = Array.isArray(body?.verticales) ? body.verticales : [];
  const nombre =
    (typeof body?.nombre === "string" && body.nombre.trim()) ||
    (await resolverNombreUsuario(user.id)) ||
    user.email.split("@")[0];

  const result = await sendPlatformEmail({
    tipo: "nuevo_proveedor",
    nombre,
    email: user.email,
    verticales,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo enviar la notificación" },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
