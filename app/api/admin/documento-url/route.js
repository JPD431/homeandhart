import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import {
  ADMIN_SIGNED_URL_TTL,
  extractStoragePath,
  isAllowedStoragePath,
  STORAGE_BUCKET,
} from "@/app/lib/storage-document-path";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Devuelve una signed URL temporal para un documento en Storage.
 * Solo admin autenticado; bucket privado vía service role.
 *
 * GET /api/admin/documento-url?storedUrl=<path o URL codificada>
 */
export async function GET(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const storedUrl = request.nextUrl.searchParams.get("storedUrl");
  if (!storedUrl?.trim()) {
    return NextResponse.json({ error: "Falta storedUrl" }, { status: 400 });
  }

  const path = extractStoragePath(storedUrl.trim());
  if (!path || !isAllowedStoragePath(path)) {
    return NextResponse.json({ error: "Ruta de documento no válida" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, ADMIN_SIGNED_URL_TTL);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn: ADMIN_SIGNED_URL_TTL,
  });
}
