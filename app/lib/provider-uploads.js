import { supabase } from "@/app/lib/supabase";
import {
  DOC_ID_TO_PROFILE_FIELD,
  getDocumentDefinition,
  getProfileFieldForDocId,
  normalizeDocumentId,
} from "@/app/lib/provider-documents";

export const STORAGE_BUCKET = "Documentos";

/** @deprecated Importar desde @/app/lib/provider-documents */
export { DOC_ID_TO_PROFILE_FIELD, getProfileFieldForDocId };

export async function uploadProfilePhoto(userId, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filePath = `${userId}/foto-perfil-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadDocumentToStorage(userId, storageKey, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const filePath = `${userId}/${storageKey}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Sube DNI/NIE/pasaporte y persiste la referencia en profiles.doc_dni_url.
 * @param {string} userId
 * @param {File} file
 */
export async function persistUserDni(userId, file) {
  const url = await uploadDocumentToStorage(userId, "doc_dni_url", file);
  const { error } = await supabase
    .from("profiles")
    .update({ doc_dni_url: url })
    .eq("id", userId);
  if (error) throw error;
  return url;
}

export async function uploadServicePhoto(userId, vertical, file, index) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filePath = `${userId}/service-${vertical}-${index}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
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
    const url = await uploadDocumentToStorage(userId, profileField, file);
    const { error } = await supabase
      .from("profiles")
      .update({ [profileField]: url })
      .eq("id", userId);
    if (error) throw error;
    return { storage: "profile", profileField, url, tipo: canonicalId };
  }

  if (def.storage === "tabla") {
    const tipo = def.tableTipo || canonicalId;
    const url = await uploadDocumentToStorage(userId, tipo, file);
    const { data, error } = await supabase
      .from("provider_documents")
      .upsert(
        {
          proveedor_id: userId,
          tipo,
          vertical: def.vertical,
          url,
        },
        { onConflict: "proveedor_id,tipo" },
      )
      .select("id, tipo, url, vertical")
      .single();

    if (error) throw error;
    return { storage: "tabla", tipo, url, row: data };
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
