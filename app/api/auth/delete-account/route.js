import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { countActiveBookingsBlockingDelete } from "@/app/lib/delete-account-active-bookings";
import { deleteUserSensitiveStorage } from "@/app/lib/delete-account-storage";

/** ~100 años — sintaxis documentada en @supabase/auth-js Admin API. */
const BAN_DURATION = "876000h";

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

function anonymizedAuthEmail(userId) {
  return `deleted-${userId}@deleted.invalid`;
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

    // ——— 1) BLOQUEO: reservas activas / pago sin liberar ———
    let activeCount = 0;
    try {
      activeCount = await countActiveBookingsBlockingDelete(
        supabaseAdmin,
        user.id,
      );
    } catch (err) {
      console.error("[delete-account] active bookings query:", err?.message || err);
      return Response.json(
        { error: "No se pudo verificar tus reservas. Inténtalo de nuevo." },
        { status: 500 },
      );
    }

    if (activeCount > 0) {
      const n = activeCount;
      return Response.json(
        {
          error: `Tienes ${n} reserva${n === 1 ? "" : "s"} activa${n === 1 ? "" : "s"}. Complétalas o cancélalas antes de eliminar tu cuenta.`,
          code: "active_bookings",
          count: n,
        },
        { status: 409 },
      );
    }

    // ——— 2) STORAGE: docs sensibles + foto (antes de tocar BD/auth) ———
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "doc_dni_url, doc_antecedentes_url, doc_antecedentes_sexuales_url, foto_perfil",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("[delete-account] profile load:", profileErr.message);
      return Response.json(
        { error: "No se pudo cargar tu perfil para borrar documentos." },
        { status: 500 },
      );
    }

    try {
      await deleteUserSensitiveStorage(
        supabaseAdmin,
        profile || {},
        user.id,
      );
    } catch (storageErr) {
      console.error(
        "[delete-account] STORAGE ABORT (no se toca auth ni BD):",
        storageErr?.message || storageErr,
      );
      return Response.json(
        {
          error:
            storageErr?.message ||
            "No se pudieron borrar tus documentos del almacenamiento. La cuenta no se ha eliminado.",
          code: "storage_delete_failed",
        },
        { status: 500 },
      );
    }

    // ——— 3) BD: anonimizar en TX (RPC) ———
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "delete_account_anonymize",
      { p_user_id: user.id },
    );

    if (rpcError) {
      console.error("[delete-account] RPC abort:", rpcError.message, rpcError);
      const isActive =
        rpcError.message?.includes("active_bookings") ||
        rpcError.code === "23514";
      if (isActive) {
        return Response.json(
          {
            error:
              "Tienes reservas activas. Complétalas o cancélalas antes de eliminar tu cuenta.",
            code: "active_bookings",
          },
          { status: 409 },
        );
      }
      return Response.json(
        {
          error:
            "No se pudo anonimizar tu cuenta en la base de datos. No se ha eliminado el acceso. Inténtalo de nuevo.",
          code: "anonymize_failed",
          detail: rpcError.message,
        },
        { status: 500 },
      );
    }

    // ——— 4) AUTH: ban + scrub email (SIN deleteUser) ———
    // deleteUser dispararía profiles ON DELETE CASCADE y destruiría el historial.
    const scrubEmail = anonymizedAuthEmail(user.id);

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { ban_duration: BAN_DURATION },
    );

    if (banError) {
      console.error(
        "[delete-account] auth.ban FAIL (BD ya anonimizada):",
        banError.message,
        banError,
      );
      return Response.json(
        {
          error:
            "Tus datos personales se han anonimizado, pero no se pudo deshabilitar el acceso de autenticación. Contacta con soporte.",
          code: "auth_ban_failed",
          anonymized: true,
          detail: banError.message,
          rpc: rpcData ?? null,
        },
        { status: 500 },
      );
    }

    // Scrub email / phone / metadata — no bloquea el éxito si falla
    const { error: scrubError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        email: scrubEmail,
        phone: "",
        user_metadata: {
          nombre: "Usuario eliminado",
          apellido: "",
          deleted: true,
          deleted_at: new Date().toISOString(),
        },
      },
    );
    if (scrubError) {
      console.error(
        "[delete-account] auth.scrub FAIL (ban OK, no bloqueante):",
        scrubError.message,
      );
    }

    // Invalidar sesiones activas (JWT actual → logout global en Auth)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (jwt) {
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
          jwt,
          "global",
        );
        if (signOutError) {
          console.error(
            "[delete-account] auth.admin.signOut FAIL (no bloqueante):",
            signOutError.message,
          );
        }
      }
    } catch (signOutErr) {
      console.error(
        "[delete-account] auth.admin.signOut excepción (no bloqueante):",
        signOutErr?.message || signOutErr,
      );
    }

    return Response.json({
      success: true,
      anonymized: true,
      auth_banned: true,
      auth_email_scrubbed: !scrubError,
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
