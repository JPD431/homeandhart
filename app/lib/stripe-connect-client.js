/**
 * Arranca el onboarding de Stripe Connect (cobros proveedor) desde el cliente.
 * @returns {Promise<{ ok: true, url: string } | { ok: false, error: string }>}
 */
export async function startStripeConnectOnboarding(fallbackMessages = {}) {
  const {
    errorInicio = "No se pudo iniciar la configuración de cobros.",
    errorUrl = "No se recibió la URL de Stripe.",
    errorConexion = "Error de conexión. Inténtalo de nuevo.",
  } = fallbackMessages;

  try {
    const res = await fetch("/api/stripe/connect/create-account", {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { ok: false, error: data.error || errorInicio };
    }
    if (!data.url) {
      return { ok: false, error: errorUrl };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: errorConexion };
  }
}
