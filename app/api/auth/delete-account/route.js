import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { executeAccountAnonymizationAndBan } from "@/app/lib/delete-account-execute";

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
 * Borrado RGPD de la cuenta del usuario autenticado.
 * Orden: verificar bloqueo → storage → anonimizar BD (RPC) → ban + scrub auth
 * (SIN deleteUser: profiles_id_fkey es ON DELETE CASCADE y destruiría el historial).
 * Body: { confirm: true }
 */
export async function POST(request) {
  try {
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

    if (body?.confirm !== true) {
      return Response.json(
        {
          error:
            "Confirmación requerida. Debes confirmar explícitamente la eliminación de la cuenta.",
          code: "confirm_required",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getAdmin();
    if (!supabaseAdmin) {
      return Response.json(
        { error: "Configuración incompleta del servidor." },
        { status: 500 },
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const result = await executeAccountAnonymizationAndBan(
      supabaseAdmin,
      user.id,
      { accessToken: session?.access_token || null },
    );

    if (!result.ok) {
      if (result.code === "active_bookings") {
        return Response.json(
          {
            error:
              result.error ||
              "Tienes reservas activas. Complétalas o cancélalas antes de eliminar tu cuenta.",
            code: "active_bookings",
          },
          { status: 409 },
        );
      }
      if (result.code === "auth_ban_failed") {
        return Response.json(
          {
            error:
              "Tus datos personales se han anonimizado, pero no se pudo deshabilitar el acceso de autenticación. Contacta con soporte.",
            code: "auth_ban_failed",
            anonymized: true,
            detail: result.detail || result.error,
            rpc: result.rpc ?? null,
          },
          { status: 500 },
        );
      }
      if (result.code === "storage_delete_failed") {
        return Response.json(
          {
            error:
              result.error ||
              "No se pudieron borrar tus documentos del almacenamiento. La cuenta no se ha eliminado.",
            code: "storage_delete_failed",
          },
          { status: 500 },
        );
      }
      if (result.code === "anonymize_failed") {
        return Response.json(
          {
            error:
              "No se pudo anonimizar tu cuenta en la base de datos. No se ha eliminado el acceso. Inténtalo de nuevo.",
            code: "anonymize_failed",
            detail: result.error,
          },
          { status: 500 },
        );
      }
      return Response.json(
        {
          error: result.error || "Error al eliminar la cuenta.",
          code: result.code || "delete_failed",
        },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      anonymized: true,
      auth_banned: true,
      auth_email_scrubbed: result.auth_email_scrubbed !== false,
      message:
        "Tu cuenta ha sido eliminada. Tus datos personales se han borrado y ya no podrás acceder.",
    });
  } catch (error) {
    console.error("[delete-account] unexpected:", error?.message || error);
    return Response.json(
      { error: error.message || "Error interno" },
      { status: 500 },
    );
  }
}
