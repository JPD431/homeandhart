import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  assertMediaPublicUrl,
  STORAGE_BUCKET_MEDIA,
} from "@/app/lib/storage-buckets";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Sube avatar o foto de servicio al bucket público Media (servidor).
 * Evita depender del bundle del cliente (p. ej. PWA cacheada).
 *
 * POST multipart: file, kind=profile|service, vertical?, index?
 */
export async function POST(request) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[api/upload/media] no autorizado", authError);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  const kind = String(formData.get("kind") || "").trim();

  if (!fileEntry || typeof fileEntry === "string") {
    console.error("[api/upload/media] archivo inválido o ausente", {
      type: typeof fileEntry,
    });
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  const fileSize =
    typeof fileEntry.size === "number" ? fileEntry.size : 0;
  const fileName =
    typeof fileEntry.name === "string" ? fileEntry.name : "upload.jpg";
  const contentType =
    (typeof fileEntry.type === "string" && fileEntry.type) || "image/jpeg";

  if (fileSize === 0) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  if (fileSize > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "La imagen no puede superar 5 MB" },
      { status: 400 },
    );
  }

  const contentTypeAllowed =
    IMAGE_TYPES.has(contentType) || contentType.startsWith("image/");
  if (!contentTypeAllowed) {
    return NextResponse.json(
      { error: "Solo se permiten imágenes" },
      { status: 400 },
    );
  }

  const ext = fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "jpg";

  let filePath;
  if (kind === "profile") {
    filePath = `${user.id}/foto-perfil-${Date.now()}.${ext}`;
  } else if (kind === "service") {
    const vertical = String(formData.get("vertical") || "servicio").trim();
    const index = Number(formData.get("index") ?? 0) || 0;
    const safeVertical = vertical.replace(/[^a-z0-9_-]/gi, "") || "servicio";
    filePath = `${user.id}/service-${safeVertical}-${index}-${Date.now()}.${ext}`;
  } else {
    return NextResponse.json(
      { error: "kind debe ser 'profile' o 'service'" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());

  console.log("[api/upload/media] subiendo", {
    userId: user.id,
    kind,
    bucket: STORAGE_BUCKET_MEDIA,
    filePath,
    fileName,
    fileSize,
    contentType,
  });

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET_MEDIA)
    .upload(filePath, buffer, {
      upsert: true,
      contentType,
    });

  if (uploadError) {
    console.error("[api/upload/media] upload error", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET_MEDIA)
    .getPublicUrl(filePath);

  console.log("[api/upload/media] ok", {
    userId: user.id,
    kind,
    filePath,
    publicUrl: data.publicUrl,
  });

  try {
    assertMediaPublicUrl(data.publicUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "URL de Media inválida" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: data.publicUrl,
    bucket: STORAGE_BUCKET_MEDIA,
    path: filePath,
  });
}
