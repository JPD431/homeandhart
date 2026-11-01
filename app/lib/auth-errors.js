import { MIN_PASSWORD_LENGTH } from "@/app/lib/password-policy";

/**
 * Traduce errores de Supabase Auth a mensajes del sistema i18n (t.authErrores).
 * Mensajes deliberadamente genéricos: no revelan si un email existe o no.
 */
export function authErrorMessage(error, t) {
  const m = t.authErrores;
  if (!error) return m.generico;

  const code = error.code || "";
  const text = (error.message || "").toLowerCase();

  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return m.invalid_credentials;
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return m.email_not_confirmed;
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    text.includes("rate limit")
  ) {
    return m.over_request_rate_limit;
  }
  if (code === "user_already_exists" || text.includes("already registered")) {
    return m.user_already_exists;
  }
  if (code === "weak_password" || text.includes("password should be")) {
    return m.weak_password(MIN_PASSWORD_LENGTH);
  }
  return m.generico;
}
