import "server-only";

import { countActiveBookingsBlockingDelete } from "@/app/lib/delete-account-active-bookings";
import { deleteUserSensitiveStorage } from "@/app/lib/delete-account-storage";

/** ~100 años — sintaxis documentada en @supabase/auth-js Admin API. */
export const ACCOUNT_BAN_DURATION = "876000h";

export function anonymizedAuthEmail(userId) {
  return `deleted-${userId}@deleted.invalid`;
}

/**
 * Flujo compartido: storage → RPC anonimizar → ban + scrub email.
 * NO llama deleteUser (CASCADE destruiría el perfil/historial).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ accessToken?: string|null }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   code?: string,
 *   error?: string,
 *   anonymized?: boolean,
 *   auth_banned?: boolean,
 *   auth_email_scrubbed?: boolean,
 *   detail?: string,
 *   rpc?: unknown,
 * }>}
 */
export async function executeAccountAnonymizationAndBan(
  supabaseAdmin,
  userId,
  opts = {},
) {
  if (!supabaseAdmin || !userId) {
    return { ok: false, code: "invalid_args", error: "Faltan admin o userId" };
  }

  let activeCount = 0;
  try {
    activeCount = await countActiveBookingsBlockingDelete(
      supabaseAdmin,
      userId,
    );
  } catch (err) {
    console.error(
      "[delete-account-execute] active bookings:",
      err?.message || err,
    );
    return {
      ok: false,
      code: "active_bookings_check_failed",
      error: "No se pudo verificar reservas activas.",
    };
  }

  if (activeCount > 0) {
    return {
      ok: false,
      code: "active_bookings",
      error: `Reservas activas (${activeCount}); no se anonimiza.`,
    };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "doc_dni_url, doc_antecedentes_url, doc_antecedentes_sexuales_url, foto_perfil, nombre",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    return {
      ok: false,
      code: "profile_load_failed",
      error: profileErr.message,
    };
  }

  // Ya anonimizado (re-ejecución idempotente)
  if (profile?.nombre === "Usuario eliminado") {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    const email = authUser?.user?.email || "";
    if (email.startsWith("deleted-") || authUser?.user?.banned_until) {
      return {
        ok: true,
        anonymized: true,
        auth_banned: true,
        auth_email_scrubbed: email.startsWith("deleted-"),
        code: "already_done",
      };
    }
  }

  try {
    await deleteUserSensitiveStorage(supabaseAdmin, profile || {}, userId);
  } catch (storageErr) {
    console.error(
      "[delete-account-execute] STORAGE ABORT:",
      storageErr?.message || storageErr,
    );
    return {
      ok: false,
      code: "storage_delete_failed",
      error: storageErr?.message || "Error borrando storage",
    };
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "delete_account_anonymize",
    { p_user_id: userId },
  );

  if (rpcError) {
    console.error("[delete-account-execute] RPC:", rpcError.message);
    const isActive =
      rpcError.message?.includes("active_bookings") ||
      rpcError.code === "23514";
    return {
      ok: false,
      code: isActive ? "active_bookings" : "anonymize_failed",
      error: rpcError.message,
      anonymized: false,
    };
  }

  const scrubEmail = anonymizedAuthEmail(userId);
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { ban_duration: ACCOUNT_BAN_DURATION },
  );

  if (banError) {
    console.error(
      "[delete-account-execute] ban FAIL (BD ya anonimizada):",
      banError.message,
    );
    return {
      ok: false,
      code: "auth_ban_failed",
      error: banError.message,
      anonymized: true,
      detail: banError.message,
      rpc: rpcData ?? null,
    };
  }

  const { error: scrubError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
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
      "[delete-account-execute] scrub FAIL (ban OK):",
      scrubError.message,
    );
  }

  const jwt = opts.accessToken;
  if (jwt) {
    try {
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
        jwt,
        "global",
      );
      if (signOutError) {
        console.error(
          "[delete-account-execute] signOut:",
          signOutError.message,
        );
      }
    } catch (e) {
      console.error("[delete-account-execute] signOut excepción:", e?.message || e);
    }
  }

  return {
    ok: true,
    anonymized: true,
    auth_banned: true,
    auth_email_scrubbed: !scrubError,
    rpc: rpcData ?? null,
  };
}
