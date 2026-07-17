import { supabase } from "@/app/lib/supabase";
import {
  assertMediaPublicUrl,
  STORAGE_BUCKET_DOCUMENTOS,
  STORAGE_BUCKET_MEDIA,
} from "@/app/lib/storage-buckets";
import {
  DOC_ID_TO_PROFILE_FIELD,
  getDocumentDefinition,
  getProfileFieldForDocId,
  normalizeDocumentId,
} from "@/app/lib/provider-documents";

export { STORAGE_BUCKET_DOCUMENTOS, STORAGE_BUCKET_MEDIA };

/** @deprecated Usar STORAGE_BUCKET_DOCUMENTOS */
export const STORAGE_BUCKET = STORAGE_BUCKET_DOCUMENTOS;

/** @deprecated Importar desde @/app/lib/provider-documents */
export { DOC_ID_TO_PROFILE_FIELD, getProfileFieldForDocId };

async function uploadMediaViaApi(file, fields) {
  const formData = new FormData();
  formData.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, String(value));
  }

  console.log("[upload/media] request", {
    kind: fields.kind,
    vertical: fields.vertical,
    index: fields.index,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });

  const res = await fetch("/api/upload/media", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const payload = await res.json().catch(() => ({}));

  console.log("[upload/media] response", {
    status: res.status,
    ok: res.ok,
    bucket: payload.bucket,
    path: payload.path,
    url: payload.url,
    error: payload.error,
  });

  if (!res.ok || !payload.url) {
    throw new Error(
      payload.error ||
        `No se pudo subir la imagen (HTTP ${res.status}). ¿Existe /api/upload/media?`,
    );
  }

  if (payload.bucket && payload.bucket !== STORAGE_BUCKET_MEDIA) {
    throw new Error(
      `El servidor subió al bucket "${payload.bucket}" en vez de "${STORAGE_BUCKET_MEDIA}".`,
    );
  }

  assertMediaPublicUrl(payload.url);
  return payload.url;
}

/**
 * Sube avatar al bucket público Media vía API (servidor).
 * @param {string} _userId — ignorado; el servidor usa la sesión autenticada
 * @param {File} file
 */
export async function uploadProfilePhoto(_userId, file) {
  return uploadMediaViaApi(file, { kind: "profile" });
}

/**
 * Sube un documento al bucket privado y devuelve la ruta relativa (no URL pública).
 * @returns {Promise<string>} Path dentro del bucket, p. ej. "{userId}/doc_dni_url-123.pdf"
 */
export async function uploadDocumentToStorage(userId, storageKey, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const filePath = `${userId}/${storageKey}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_DOCUMENTOS)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return filePath;
}

/**
 * Sube DNI/NIE/pasaporte y persiste la ruta en profiles.doc_dni_url.
 * Deja el documento en revisión admin (dni_estado = pendiente).
 * @param {string} userId
 * @param {File} file
 * @returns {Promise<string>} Ruta relativa en Storage (no URL pública)
 */
export async function persistUserDni(userId, file) {
  const storagePath = await uploadDocumentToStorage(userId, "doc_dni_url", file);
  const { error } = await supabase
    .from("profiles")
    .update({
      doc_dni_url: storagePath,
      dni_estado: "pendiente",
      dni_verificado_at: null,
      dni_verificado_por: null,
    })
    .eq("id", userId);
  if (error) throw error;
  return storagePath;
}

/**
 * Sube foto de anuncio al bucket público Media vía API (servidor).
 * @param {string} _userId — ignorado; el servidor usa la sesión autenticada
 * @param {string} vertical
 * @param {File} file
 * @param {number} index
 */
export async function uploadServicePhoto(_userId, vertical, file, index) {
  console.log("[uploadServicePhoto] llamada", {
    vertical,
    storageIndex: index,
    fileName: file.name,
    fileSize: file.size,
  });
  return uploadMediaViaApi(file, {
    kind: "service",
    vertical,
    index,
  });
}

/**
 * Sube varias fotos de servicio con índices correlativos en Storage (0, 1, 2…).
 * @param {string} _userId
 * @param {string} vertical
 * @param {File[]} files
 * @param {number} [startIndex=0] — índice de la primera foto (p. ej. fotos ya guardadas)
 * @returns {Promise<string[]>}
 */
export async function uploadServicePhotosBatch(
  _userId,
  vertical,
  files,
  startIndex = 0,
) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const storageIndex = startIndex + i;
    const url = await uploadServicePhoto(
      _userId,
      vertical,
      files[i],
      storageIndex,
    );
    urls.push(url);
  }
  console.log("[uploadServicePhotosBatch] completo", {
    vertical,
    startIndex,
    filesCount: files.length,
    urlsCount: urls.length,
    storageIndices: files.map((_, i) => startIndex + i),
    urls,
  });
  return urls;
}

/**
 * Carga todos los documentos de provider_documents para un proveedor.
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, proveedor_id: string, tipo: string, vertical: string | null, url: string, created_at: string, updated_at: string }>>}
 */
export async function loadProviderDocuments(userId) {
  const { data, error } = await supabase
    .from("provider_documents")
    .select("id, proveedor_id, tipo, vertical, url, created_at, updated_at")
    .eq("proveedor_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Persiste un documento según el storage del catálogo (profile | tabla).
 * Los campos de texto (NRU) no se suben aquí.
 * @param {string} userId
 * @param {string} docId
 * @param {File} file
 */
export async function persistProviderDocument(userId, docId, file) {
  const canonicalId = normalizeDocumentId(docId);
  const def = getDocumentDefinition(canonicalId);

  if (!def) {
    throw new Error(`Documento desconocido: ${docId}`);
  }

  if (def.storage === "texto") {
    throw new Error(
      `El documento ${def.label} es un campo de texto, no un archivo.`,
    );
  }

  if (def.storage === "profile") {
    const profileField = def.profileField;
    if (!profileField) {
      throw new Error(`Sin columna de perfil para: ${docId}`);
    }
    const storagePath = await uploadDocumentToStorage(userId, profileField, file);
    const { error } = await supabase
      .from("profiles")
      .update({ [profileField]: storagePath })
      .eq("id", userId);
    if (error) throw error;
    return { storage: "profile", profileField, url: storagePath, tipo: canonicalId };
  }

  if (def.storage === "tabla") {
    const tipo = def.tableTipo || canonicalId;
    const storagePath = await uploadDocumentToStorage(userId, tipo, file);
    const { data, error } = await supabase
      .from("provider_documents")
      .upsert(
        {
          proveedor_id: userId,
          tipo,
          vertical: def.vertical,
          url: storagePath,
        },
        { onConflict: "proveedor_id,tipo" },
      )
      .select("id, tipo, url, vertical")
      .single();

    if (error) throw error;
    return { storage: "tabla", tipo, url: storagePath, row: data };
  }

  throw new Error(`Storage no soportado para: ${docId}`);
}

/**
 * Sube un documento del wizard y persiste la URL (compat Fase 1).
 * @param {string} docId - ID del catálogo (dni_nie, certificado_antecedentes, …)
 */
export async function persistWizardDocument(userId, docId, file) {
  const result = await persistProviderDocument(userId, docId, file);
  if (result.storage === "profile") {
    return { profileField: result.profileField, url: result.url };
  }
  return { profileField: null, url: result.url, tipo: result.tipo };
}
