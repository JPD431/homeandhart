import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { buildUserDataExport } from "@/app/lib/export-user-data";

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
 * GET/POST /api/auth/export-data
 * Exporta los datos personales del usuario autenticado (RGPD acceso/portabilidad).
 */
async function handleExport() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) {
    return Response.json(
      { error: "Configuración incompleta del servidor." },
      { status: 500 },
    );
  }

  try {
    const payload = await buildUserDataExport(admin, user);
    const body = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `mis-datos-homeandheart-${date}.json`;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-data]", err?.message || err);
    return Response.json(
      {
        error:
          err?.message ||
          "No se pudo generar la exportación. Inténtalo de nuevo.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return handleExport();
}

export async function POST() {
  return handleExport();
}
