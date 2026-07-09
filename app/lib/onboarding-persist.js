import { parseCapacidadFromDb } from "@/app/lib/capacidad";
import { normalizeDescuentosDuracion } from "@/app/lib/descuentosDuracion";
import { uploadProfilePhoto, uploadServicePhoto } from "@/app/lib/provider-uploads";
import {
  buildServicePayload,
  DIAS_DISPONIBLES_DEFAULT,
  getServiceLocationFields,
  parseAnosExperienciaFromDb,
  parseCheckTimesFromDb,
  parseMascotasBooleansFromDb,
  parseMascotasDetalleFromDb,
  parseNinosDetalleFromDb,
  parseNormasFromDb,
} from "@/app/lib/service-payload";
import {
  getServicePhotoLimit,
  normalizeFotosArray,
  parseFotosFromDb,
  syncServicePhotos,
} from "@/app/lib/service-photos";
import { supabase } from "@/app/lib/supabase";

export const REVISION_BORRADOR = "borrador";
export const REVISION_EN_REVISION = "en_revision";
export const REVISION_APROBADO = "aprobado";
export const REVISION_RECHAZADO = "rechazado";

export const ONBOARDING_PROFILE_FIELDS =
  "id, nombre, apellido, ciudad, descripcion, idiomas, foto_perfil, role, onboarding_step, onboarding_completed_at, onboarding_verticales, doc_dni_url, doc_antecedentes_url, doc_antecedentes_sexuales_url, anos_experiencia";

export function buildProfileBio(sobreTi, personalidad, motivacion, anosExperiencia) {
  const parts = [sobreTi.trim()];
  if (personalidad.trim()) parts.push(`Personalidad: ${personalidad.trim()}`);
  if (motivacion.trim()) parts.push(`Motivación: ${motivacion.trim()}`);
  if (anosExperiencia.trim()) {
    parts.push(`Experiencia: ${anosExperiencia.trim()} años`);
  }
  return parts.join("\n\n");
}

export function parseProfileBio(descripcion) {
  const desc = descripcion || "";
  const personalidadMatch = desc.match(/Personalidad:\s*(.+?)(?:\n\n|$)/s);
  const motivacionMatch = desc.match(/Motivación:\s*(.+?)(?:\n\n|$)/s);
  const experienciaMatch = desc.match(/Experiencia:\s*(.+?)(?:\n\n|$)/s);

  let sobreTi = desc;
  if (personalidadMatch || motivacionMatch || experienciaMatch) {
    sobreTi = desc.split(/\n\n(?:Personalidad|Motivación|Experiencia):/)[0].trim();
  }

  return {
    sobreTi,
    personalidad: personalidadMatch?.[1]?.trim() || "",
    motivacion: motivacionMatch?.[1]?.trim() || "",
    anosExperiencia: experienciaMatch?.[1]?.replace(/\s*años\s*$/, "").trim() || "",
  };
}

export async function saveOnboardingStep(userId, stepId) {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: String(stepId) })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveVerticalesStep(userId, verticales, stepId) {
  const uniqueVerticales = [...new Set(verticales)];
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      role: "proveedor",
      onboarding_verticales: uniqueVerticales,
      onboarding_step: String(stepId),
    });
  if (error) throw error;
}

export async function saveProfileStep(userId, fields, stepId) {
  const {
    nombre,
    apellido,
    ciudad,
    sobreTi,
    personalidad,
    motivacion,
    anosExperiencia,
    idiomas,
    fotoPerfilUrl,
    profilePhotoFile,
  } = fields;

  let fotoUrl = fotoPerfilUrl || null;
  if (profilePhotoFile) {
    fotoUrl = await uploadProfilePhoto(userId, profilePhotoFile);
  }

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    ciudad: ciudad.trim(),
    descripcion: buildProfileBio(sobreTi, personalidad, motivacion, anosExperiencia),
    idiomas,
    foto_perfil: fotoUrl,
    anos_experiencia: anosExperiencia ? Number(anosExperiencia) : null,
    role: "proveedor",
    onboarding_step: String(stepId),
  });

  if (error) throw error;
  return fotoUrl;
}

async function findDraftServiceId(userId, vertical) {
  const { data } = await supabase
    .from("services")
    .select("id")
    .eq("proveedor_id", userId)
    .eq("vertical", vertical)
    .eq("revision_estado", REVISION_BORRADOR)
    .maybeSingle();
  return data?.id ?? null;
}

export async function upsertDraftService(
  userId,
  vertical,
  ciudad,
  servicioData,
  knownDraftId = null,
  servicePhotos = [],
) {
  const locationFields = await getServiceLocationFields(servicioData, vertical);
  const existingFotos = parseFotosFromDb({
    fotos: servicioData.fotos,
    foto_url: servicioData.foto_url,
  });
  const limit = getServicePhotoLimit(vertical);
  const uploadedUrls = [];

  if (servicePhotos.length > 0) {
    const startIndex = existingFotos.length;
    for (let i = 0; i < servicePhotos.length; i++) {
      if (existingFotos.length + uploadedUrls.length >= limit) break;
      const photoUrl = await uploadServicePhoto(
        userId,
        vertical,
        servicePhotos[i],
        startIndex + i,
      );
      uploadedUrls.push(photoUrl);
    }
  }

  const allFotos = normalizeFotosArray(
    [...existingFotos, ...uploadedUrls],
  ).slice(0, limit);

  const payload = {
    ...buildServicePayload(servicioData, vertical, ciudad, userId, false),
    ...locationFields,
    revision_estado: REVISION_BORRADOR,
  };
  syncServicePhotos(payload, allFotos);

  const draftId = knownDraftId ?? (await findDraftServiceId(userId, vertical));

  if (draftId) {
    const { data, error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", draftId)
      .select("id, fotos, foto_url")
      .single();
    if (error) throw error;
    return { id: data.id, fotos: parseFotosFromDb(data) };
  }

  const { data, error } = await supabase
    .from("services")
    .insert(payload)
    .select("id, fotos, foto_url")
    .single();
  if (error) throw error;
  return { id: data.id, fotos: parseFotosFromDb(data) };
}

export function mapDraftRowToServiceDetails(row) {
  const tiers = normalizeDescuentosDuracion(row.descuentos_duracion);
  const fotos = parseFotosFromDb(row);
  const base = {
    titulo: row.titulo || "",
    descripcion: row.descripcion || row.descripcion_anuncio || "",
    precio: row.precio ?? "",
    location_zone: row.location_zone || "",
    location_lat: row.location_lat ?? null,
    location_lng: row.location_lng ?? null,
    tipo_alojamiento: row.tipo_alojamiento || "",
    modalidad: row.modalidad || "domicilio_cliente",
    estancia_minima: row.estancia_minima != null ? String(row.estancia_minima) : "1",
    estancia_maxima: row.estancia_maxima != null ? String(row.estancia_maxima) : "",
    antelacion_minima: row.antelacion_minima ?? 24,
    dias_disponibles:
      row.dias_disponibles?.length > 0 ? row.dias_disponibles : [...DIAS_DISPONIBLES_DEFAULT],
    cancelacion: row.cancellation_policy || "moderada",
    reserva_inmediata: row.reserva_inmediata === true,
    direccion_exacta: row.direccion_exacta || "",
    telefono_contacto: row.telefono_contacto || "",
    disponible_para_viajar: row.disponible_para_viajar === true,
    proveedor_emergencia: row.proveedor_emergencia === true,
    amenities: row.amenities || [],
    fotos,
    foto_url: fotos[0] || "",
    capacidad: parseCapacidadFromDb(row),
    descuentos_duracion_activa: tiers.length > 0,
    descuentos_duracion:
      tiers.length > 0
        ? tiers.map((t) => ({
            minDias: String(t.minDias),
            descuento: String(t.descuento),
          }))
        : [{ minDias: "", descuento: "" }],
  };

  if (row.vertical === "alojamiento") {
    return {
      ...base,
      nru: row.nru || "",
      normas: parseNormasFromDb(row),
      ...parseCheckTimesFromDb(row),
    };
  }

  if (row.vertical === "ninos") {
    return {
      ...base,
      anos_experiencia: parseAnosExperienciaFromDb(row),
      ...parseNinosDetalleFromDb(row),
    };
  }

  return {
    ...base,
    anos_experiencia: parseAnosExperienciaFromDb(row),
    ...parseMascotasDetalleFromDb(row),
    ...parseMascotasBooleansFromDb(row),
  };
}

export async function loadOnboardingState(userId) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(ONBOARDING_PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const { data: drafts, error: draftsError } = await supabase
    .from("services")
    .select("*")
    .eq("proveedor_id", userId)
    .eq("revision_estado", REVISION_BORRADOR);

  if (draftsError) throw draftsError;

  return { profile, drafts: drafts ?? [] };
}

export async function finalizeOnboarding(userId, verticales, draftIdsByVertical) {
  const ids = verticales
    .map((v) => draftIdsByVertical[v])
    .filter(Boolean);

  if (ids.length > 0) {
    const { error: servicesError } = await supabase
      .from("services")
      .update({ revision_estado: REVISION_EN_REVISION })
      .in("id", ids);
    if (servicesError) throw servicesError;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: "confirmacion",
    })
    .eq("id", userId);

  if (profileError) throw profileError;
}
