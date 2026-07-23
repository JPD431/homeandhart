import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";

/**
 * Admin solicita documentación adicional a un proveedor.
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

  const proveedorId = body?.proveedor_id;
  const documentos = Array.isArray(body?.documentos) ? body.documentos : [];
  const proveedorNombre =
    typeof body?.proveedor_nombre === "string" ? body.proveedor_nombre : "";
  const mensaje =
    typeof body?.mensaje === "string" ? body.mensaje.trim() : "";
  const asunto =
    typeof body?.asunto === "string" && body.asunto.trim()
      ? body.asunto.trim()
      : "Home&Heart — Necesitamos documentación adicional";

  if (!proveedorId || typeof proveedorId !== "string") {
    return NextResponse.json(
      { error: "Falta proveedor_id" },
      { status: 400 },
    );
  }

  if (documentos.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos un documento" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  const result = await dispatchPlatformEmail({
    tipo: "solicitud_documentos",
    proveedor_id: proveedorId,
    proveedor_nombre: proveedorNombre,
    documentos,
    mensaje,
    asunto,
    perfil_url: `${baseUrl}/ser-proveedor`,
  });

  if (!result.ok) {
    console.error(
      "[admin/solicitud-documentos] FALLO email",
      result.status,
      result.error,
    );
    return NextResponse.json(
      { error: result.error || "No se pudo enviar la solicitud" },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
