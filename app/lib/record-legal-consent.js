import "server-only";
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/app/lib/legal-versions";

/**
 * Persiste aceptación vigente de términos + privacidad (profiles + histórico).
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} userId
 * @param {{ source?: "registro" | "reaceptacion" | "api" }} [opts]
 */
export async function recordLegalConsent(admin, userId, opts = {}) {
  const source = opts.source || "api";
  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      acepto_terminos_at: now,
      terminos_version: TERMS_VERSION,
      acepto_privacidad_at: now,
      privacidad_version: PRIVACY_VERSION,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message || "No se pudo guardar el consentimiento");
  }

  const rows = [
    {
      user_id: userId,
      document_type: "terminos",
      document_version: TERMS_VERSION,
      accepted_at: now,
      source,
    },
    {
      user_id: userId,
      document_type: "privacidad",
      document_version: PRIVACY_VERSION,
      accepted_at: now,
      source,
    },
  ];

  const { error: consentsError } = await admin.from("user_consents").insert(rows);
  if (consentsError) {
    throw new Error(
      consentsError.message || "No se pudo registrar el histórico de consentimiento",
    );
  }

  return {
    acepto_terminos_at: now,
    terminos_version: TERMS_VERSION,
    acepto_privacidad_at: now,
    privacidad_version: PRIVACY_VERSION,
  };
}

/**
 * ¿El perfil tiene aceptación vigente de ambas versiones actuales?
 */
export function hasCurrentLegalConsent(profile) {
  if (!profile) return false;
  return (
    Boolean(profile.acepto_terminos_at) &&
    profile.terminos_version === TERMS_VERSION &&
    Boolean(profile.acepto_privacidad_at) &&
    profile.privacidad_version === PRIVACY_VERSION
  );
}
