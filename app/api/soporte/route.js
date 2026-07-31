import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/app/lib/rate-limit";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const SOPORTE_EMAIL = "soporte@homeandheart.es";

function getAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * POST /api/soporte
 * Formulario de ayuda general → email a soporte@ (no incidencias ni reports).
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

  const limited = await enforceRateLimit(request, {
    limit: 5,
    window: "15 m",
    prefix: "soporte",
    userId: user.id,
  });
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const asunto =
    typeof body?.asunto === "string" ? body.asunto.trim().slice(0, 160) : "";
  const mensaje =
    typeof body?.mensaje === "string" ? body.mensaje.trim().slice(0, 4000) : "";
  const pageUrl =
    typeof body?.page_url === "string" ? body.page_url.trim().slice(0, 500) : "";

  if (!asunto || asunto.length < 3) {
    return NextResponse.json(
      { error: "Indica un asunto (mín. 3 caracteres)." },
      { status: 400 },
    );
  }
  if (!mensaje || mensaje.length < 10) {
    return NextResponse.json(
      { error: "Describe tu consulta (mín. 10 caracteres)." },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  let rol = "usuario";
  let nombre = "Usuario";
  if (admin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("nombre, apellido, role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      rol = profile.role || "usuario";
      nombre =
        [profile.nombre, profile.apellido].filter(Boolean).join(" ").trim() ||
        "Usuario";
    }
  }

  const email = user.email || "";

  // No enviar automatismos al usuario: solo email dirigido a soporte@.
  const result = await sendPlatformEmail({
    tipo: "soporte_contacto",
    to: SOPORTE_EMAIL,
    reply_to: email || undefined,
    user_id: user.id,
    nombre,
    rol,
    email,
    asunto,
    mensaje,
    page_url: pageUrl || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo enviar el mensaje." },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
