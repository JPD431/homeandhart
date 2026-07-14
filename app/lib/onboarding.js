export const ONBOARDING_PROFILE_SELECT =
  "role, onboarding_completed_at, onboarding_verticales, necesidades, ciudad, nombre, apellido, doc_dni_url";

/**
 * Cliente que ya pasó por completar-perfil (tiene necesidades o ciudad).
 */
export function clientePerfilCompleto(profile) {
  if (!profile) return false;
  const necesidades = profile.necesidades;
  const tieneNecesidades = Array.isArray(necesidades) && necesidades.length > 0;
  const tieneCiudad =
    typeof profile.ciudad === "string" && profile.ciudad.trim().length > 0;
  return tieneNecesidades || tieneCiudad;
}

export function needsProviderOnboarding(profile) {
  return profile?.role === "proveedor" && !profile?.onboarding_completed_at;
}

/**
 * Ruta post-login o post-verificación según perfil y último modo guardado.
 * @param {object|null|undefined} profile
 * @param {'cliente' | 'proveedor' | null} [storedModo] — cookie/localStorage hh_modo
 * @returns {string}
 */
export function resolvePostAuthRedirect(profile, storedModo = null) {
  const role = profile?.role || "cliente";

  if (role === "proveedor") {
    if (!profile?.onboarding_completed_at) {
      return "/ser-proveedor";
    }
    if (storedModo === "cliente") {
      return "/buscar";
    }
    return "/dashboard?tab=proveedor";
  }

  if (clientePerfilCompleto(profile)) {
    return "/buscar";
  }

  return "/completar-perfil";
}

/**
 * Carga el perfil y devuelve la ruta de redirección.
 */
export async function getPostAuthRedirect(supabase, userId) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(ONBOARDING_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[onboarding] Error cargando perfil:", error.message);
  }

  if (profile) {
    return resolvePostAuthRedirect(profile);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return resolvePostAuthRedirect({
    role: user?.user_metadata?.role || "cliente",
  });
}
