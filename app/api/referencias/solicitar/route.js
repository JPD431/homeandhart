import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RELACION_OPTIONS } from "@/app/lib/referencias";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const RELACION_VALUES = new Set(RELACION_OPTIONS);

async function sendSolicitudReferenciaEmail(payload) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    console.error(
      "[referencias/solicitar] NEXT_PUBLIC_URL no configurada, email omitido",
    );
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(
        "[referencias/solicitar] Error enviando email:",
        data.error || res.status,
      );
    }
  } catch (err) {
    console.error("[referencias/solicitar] Error enviando email:", err);
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const nombreReferente =
    typeof body?.nombre_referente === "string"
      ? body.nombre_referente.trim()
      : "";
  const emailReferente =
    typeof body?.email_referente === "string"
      ? body.email_referente.trim().toLowerCase()
      : "";
  const relacion =
    typeof body?.relacion === "string" ? body.relacion.trim() : "";

  if (!nombreReferente || !emailReferente) {
    return NextResponse.json(
      { error: "Completa el nombre y el email del referente." },
      { status: 400 },
    );
  }

  if (!relacion || !RELACION_VALUES.has(relacion)) {
    return NextResponse.json({ error: "Relación no válida" }, { status: 400 });
  }

  const token = crypto.randomUUID();

  const { error: insertError } = await supabaseAdmin.from("referencias").insert({
    proveedor_id: user.id,
    nombre_referente: nombreReferente,
    email_referente: emailReferente,
    relacion,
    estado: "pendiente",
    token,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido, foto_perfil, foto_url")
    .eq("id", user.id)
    .maybeSingle();

  const proveedorNombre =
    [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim() ||
    "Proveedor";
  const proveedorFoto = perfil?.foto_perfil || perfil?.foto_url || null;
  const baseUrl = process.env.NEXT_PUBLIC_URL || "";

  await sendSolicitudReferenciaEmail({
    tipo: "solicitud_referencia",
    destinatario_email: emailReferente,
    referente_nombre: nombreReferente,
    proveedor_nombre: proveedorNombre,
    proveedor_foto: proveedorFoto,
    aval_url: `${baseUrl}/referencias/${token}`,
  });

  return NextResponse.json({ ok: true });
}
