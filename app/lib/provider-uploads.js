import { supabase } from "@/app/lib/supabase";

export const STORAGE_BUCKET = "Documentos";

/** IDs del wizard → columnas en profiles */
export const DOC_ID_TO_PROFILE_FIELD = {
  dni_propietario: "doc_dni_url",
  dni_nie: "doc_dni_url",
  certificado_antecedentes: "doc_antecedentes_url",
  certificado_delitos_sexuales: "doc_antecedentes_sexuales_url",
};

export function getProfileFieldForDocId(docId) {
  return DOC_ID_TO_PROFILE_FIELD[docId] || null;
}

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
 * Sube un documento del wizard y persiste la URL en profiles.
 * @param {string} docId - ID del catálogo (dni_nie, certificado_antecedentes, …)
 */
export async function persistWizardDocument(userId, docId, file) {
  const profileField = getProfileFieldForDocId(docId);
  if (!profileField) {
    throw new Error(`Documento no persistible: ${docId}`);
  }
  const url = await uploadDocumentToStorage(userId, profileField, file);
  const { error } = await supabase
    .from("profiles")
    .update({ [profileField]: url })
    .eq("id", userId);
  if (error) throw error;
  return { profileField, url };
}
