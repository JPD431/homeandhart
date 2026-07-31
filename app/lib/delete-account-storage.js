import {
  STORAGE_BUCKET_DOCUMENTOS,
  STORAGE_BUCKET_MEDIA,
} from "@/app/lib/storage-buckets";
import {
  extractStoragePath,
  isAllowedStoragePath,
} from "@/app/lib/storage-document-path";

/**
 * Path relativo en bucket Media a partir de URL pública o path.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function extractMediaStoragePath(url) {
  if (!url || typeof url !== "string") return null;

  const publicMatch =
    url.match(/\/object\/public\/Media\/(.+?)(\?|$)/i) ||
    url.match(/\/object\/public\/media\/(.+?)(\?|$)/i);
  if (publicMatch) {
    return decodeURIComponent(publicMatch[1]);
  }

  const path = url.replace(/^\/+/, "");
  if (path && !path.includes("://") && isAllowedStoragePath(path)) {
    return path;
  }
  return null;
}

/**
 * Borra del Storage los documentos sensibles + foto de perfil del usuario.
 * Si falla un doc sensible (DNI/antecedentes) tras 1 reintento → lanza (el caller aborta).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{
 *   doc_dni_url?: string|null,
 *   doc_antecedentes_url?: string|null,
 *   doc_antecedentes_sexuales_url?: string|null,
 *   foto_perfil?: string|null,
 * }} profile
 * @param {string} userId
 */
export async function deleteUserSensitiveStorage(supabaseAdmin, profile, userId) {
  const sensitiveDocs = [];
  for (const raw of [
    profile?.doc_dni_url,
    profile?.doc_antecedentes_url,
    profile?.doc_antecedentes_sexuales_url,
  ]) {
    const path = extractStoragePath(raw);
    if (path && isAllowedStoragePath(path)) {
      sensitiveDocs.push(path);
    }
  }

  // También listar carpeta {userId}/ en Documentos (versiones huérfanas)
  const listedDocs = await listPrefixFilePaths(
    supabaseAdmin,
    STORAGE_BUCKET_DOCUMENTOS,
    userId,
  );
  const allSensitive = [...new Set([...sensitiveDocs, ...listedDocs])];

  if (allSensitive.length > 0) {
    await removeWithRetryOrThrow(
      supabaseAdmin,
      STORAGE_BUCKET_DOCUMENTOS,
      allSensitive,
      "documentos_sensibles",
    );

    const leftover = await listPrefixFilePaths(
      supabaseAdmin,
      STORAGE_BUCKET_DOCUMENTOS,
      userId,
    );
    if (leftover.length > 0) {
      const msg =
        `Quedan ${leftover.length} archivo(s) en Documentos/${userId}/ tras el borrado: ` +
        leftover.slice(0, 5).join(", ");
      console.error("[delete-account] storage verify FAIL:", msg);
      throw new Error(
        "No se pudieron borrar todos los documentos de identidad del almacenamiento. Inténtalo de nuevo o contacta con soporte.",
      );
    }
  }

  // Foto de perfil (Media) — fallo también aborta para no dejar PII visual
  const mediaPaths = new Set();
  const fotoPath = extractMediaStoragePath(profile?.foto_perfil);
  if (fotoPath) mediaPaths.add(fotoPath);

  const listedMedia = await listPrefixFilePaths(
    supabaseAdmin,
    STORAGE_BUCKET_MEDIA,
    userId,
  );
  // Solo foto-perfil* del usuario (no borrar fotos de servicio aquí de forma agresiva
  // si el path listado es toda la carpeta — el usuario pidió foto_perfil;
  // listamos y borramos foto-perfil* + path de foto_perfil)
  for (const p of listedMedia) {
    if (p.includes("/foto-perfil-") || p.startsWith(`${userId}/foto-perfil-`)) {
      mediaPaths.add(p);
    }
  }

  if (mediaPaths.size > 0) {
    await removeWithRetryOrThrow(
      supabaseAdmin,
      STORAGE_BUCKET_MEDIA,
      [...mediaPaths],
      "foto_perfil",
    );
  }
}

async function listPrefixFilePaths(supabaseAdmin, bucket, prefix) {
  const paths = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      const msg = String(error.message || "");
      if (/not found|does not exist/i.test(msg)) return paths;
      console.error(`[delete-account] storage.list ${bucket}/${prefix}:`, msg);
      throw new Error(
        `No se pudo listar archivos en almacenamiento (${bucket}). Inténtalo de nuevo.`,
      );
    }

    if (!data?.length) break;

    for (const obj of data) {
      if (!obj?.name) continue;
      // Estructura actual: {userId}/archivo.ext (plano). Si es carpeta (sin id), bajar un nivel.
      if (obj.id == null && obj.metadata == null) {
        const nested = await listPrefixFilePaths(
          supabaseAdmin,
          bucket,
          `${prefix}/${obj.name}`,
        );
        paths.push(...nested);
      } else {
        paths.push(`${prefix}/${obj.name}`);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function removeWithRetryOrThrow(supabaseAdmin, bucket, paths, label) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      for (let i = 0; i < unique.length; i += 100) {
        const chunk = unique.slice(i, i + 100);
        const { error } = await supabaseAdmin.storage
          .from(bucket)
          .remove(chunk);
        if (error) {
          throw new Error(error.message || "storage.remove failed");
        }
      }
      console.info(
        `[delete-account] storage.remove OK (${label}) attempt=${attempt} count=${unique.length}`,
      );
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `[delete-account] storage.remove FAIL (${label}) attempt=${attempt}:`,
        err?.message || err,
        { bucket, sample: unique.slice(0, 5) },
      );
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw new Error(
    `No se pudieron borrar archivos sensibles del almacenamiento (${label}): ${lastError?.message || "error desconocido"}`,
  );
}
