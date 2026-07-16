import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { previewEmailHtml } from "@/app/lib/email-layouts";

/**
 * Vista previa HTML de emails (plantillas reales).
 * GET /api/admin/preview-email?tipo=marketing|transaccional
 * Solo admin autenticado. No envía correos.
 */
export async function GET(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "marketing";
  const html = previewEmailHtml(tipo);

  if (!html) {
    return NextResponse.json(
      {
        error: "Tipo no válido. Usa tipo=marketing o tipo=transaccional",
      },
      { status: 400 },
    );
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
