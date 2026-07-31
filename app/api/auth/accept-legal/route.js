import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { recordLegalConsent } from "@/app/lib/record-legal-consent";
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/app/lib/legal-versions";

function getAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * POST /api/auth/accept-legal
 * Body: { acepto_terminos: true, acepto_privacidad: true, source?: "reaceptacion"|"registro"|"api" }
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!body.acepto_terminos || !body.acepto_privacidad) {
    return Response.json(
      {
        error:
          "Debes aceptar los términos de uso y la política de privacidad.",
      },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return Response.json(
      { error: "Configuración incompleta del servidor." },
      { status: 500 },
    );
  }

  const source =
    body.source === "registro" || body.source === "reaceptacion"
      ? body.source
      : "api";

  try {
    const consent = await recordLegalConsent(admin, user.id, { source });
    return Response.json({
      success: true,
      consent,
      versions: {
        terminos: TERMS_VERSION,
        privacidad: PRIVACY_VERSION,
      },
    });
  } catch (err) {
    console.error("[accept-legal]", err?.message || err);
    return Response.json(
      {
        error:
          err?.message ||
          "No se pudo guardar el consentimiento. Inténtalo de nuevo.",
      },
      { status: 500 },
    );
  }
}
