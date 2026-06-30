const DEFAULT_REDIRECT = "/completar-perfil";

/** Destino post-login vía API server-side (incluye detección de admin). */
export async function fetchPostLoginRedirect() {
  try {
    const res = await fetch("/api/auth/post-login-redirect");
    const data = await res.json().catch(() => ({}));
    if (typeof data?.redirect === "string" && data.redirect.length > 0) {
      return data.redirect;
    }
  } catch (err) {
    console.error("[post-login-redirect] Error en cliente:", err);
  }
  return DEFAULT_REDIRECT;
}
