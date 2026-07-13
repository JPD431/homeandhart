/** Lógica compartida de invitaciones a familia (server-side). */

export function normalizeInviteEmail(email) {
  return email?.trim().toLowerCase() ?? "";
}

function inviteMatchesUser(invitacion, userId, email) {
  const normalized = normalizeInviteEmail(email);
  const emailMatch =
    invitacion.email_invitado &&
    normalizeInviteEmail(invitacion.email_invitado) === normalized;
  const perfilMatch =
    invitacion.perfil_id === userId ||
    (!invitacion.perfil_id && emailMatch);
  return emailMatch && perfilMatch;
}

/** Vincula perfil_id en invitaciones pendientes sin activarlas. */
export async function linkPendingInvitesToProfile(admin, userId, email) {
  if (!userId || !email) return;

  const normalized = normalizeInviteEmail(email);
  if (!normalized) return;

  const { data: pending, error: fetchError } = await admin
    .from("familia_miembros")
    .select("id, perfil_id")
    .eq("estado", "pendiente")
    .ilike("email_invitado", normalized);

  if (fetchError) {
    console.error("[familia-invites] Error buscando pendientes:", fetchError);
    return;
  }

  const toLink = (pending ?? []).filter(
    (row) => !row.perfil_id || row.perfil_id === userId,
  );

  for (const row of toLink) {
    if (row.perfil_id === userId) continue;
    const { error: updateError } = await admin
      .from("familia_miembros")
      .update({ perfil_id: userId })
      .eq("id", row.id)
      .eq("estado", "pendiente");
    if (updateError) {
      console.error("[familia-invites] Error vinculando perfil:", updateError);
    }
  }
}

const INVITE_SELECT = `
  id,
  familia_id,
  email_invitado,
  perfil_id,
  estado,
  created_at,
  familias (
    id,
    nombre
  )
`;

/** Invitaciones pendientes del usuario (por email o perfil vinculado). */
export async function getPendingInvitesForUser(admin, userId, email) {
  const normalized = normalizeInviteEmail(email);
  if (!userId || !normalized) return [];

  const [byProfile, byEmail] = await Promise.all([
    admin
      .from("familia_miembros")
      .select(INVITE_SELECT)
      .eq("estado", "pendiente")
      .eq("perfil_id", userId),
    admin
      .from("familia_miembros")
      .select(INVITE_SELECT)
      .eq("estado", "pendiente")
      .ilike("email_invitado", normalized),
  ]);

  if (byProfile.error) {
    console.error("[familia-invites] Error por perfil:", byProfile.error);
  }
  if (byEmail.error) {
    console.error("[familia-invites] Error por email:", byEmail.error);
  }

  const merged = new Map();
  for (const row of [...(byProfile.data ?? []), ...(byEmail.data ?? [])]) {
    if (!inviteMatchesUser(row, userId, email)) continue;
    merged.set(row.id, row);
  }

  return [...merged.values()].map((row) => ({
    id: row.id,
    familia_id: row.familia_id,
    familia_nombre: row.familias?.nombre ?? "Home&Heart",
    created_at: row.created_at,
  }));
}

export async function getUserActiveFamilia(admin, userId) {
  const { data, error } = await admin
    .from("familia_miembros")
    .select("id, familia_id, familias ( nombre )")
    .eq("perfil_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) {
    console.error("[familia-invites] Error leyendo familia activa:", error);
    return null;
  }

  return data;
}

/**
 * Acepta una invitación pendiente. Idempotente si ya es miembro activo de esa familia.
 * @returns {{ ok: boolean, code?: string, message?: string, familia_nombre?: string }}
 */
export async function acceptFamiliaInvite(admin, userId, email, invitacionId) {
  const normalized = normalizeInviteEmail(email);
  if (!userId || !normalized || !invitacionId) {
    return { ok: false, code: "invalid", message: "Datos inválidos." };
  }

  const { data: invitacion, error: inviteError } = await admin
    .from("familia_miembros")
    .select(INVITE_SELECT)
    .eq("id", invitacionId)
    .maybeSingle();

  if (inviteError) {
    return { ok: false, code: "error", message: inviteError.message };
  }

  if (!invitacion) {
    return { ok: false, code: "not_found", message: "Invitación no encontrada." };
  }

  const familiaNombre = invitacion.familias?.nombre ?? "Home&Heart";

  if (invitacion.estado === "activo") {
    if (invitacion.perfil_id === userId) {
      return {
        ok: true,
        code: "already_active",
        message: "Ya formas parte de este grupo familiar.",
        familia_nombre: familiaNombre,
      };
    }
    return {
      ok: false,
      code: "already_taken",
      message: "Esta invitación ya fue aceptada.",
    };
  }

  if (invitacion.estado !== "pendiente") {
    return {
      ok: false,
      code: "invalid_state",
      message: "Esta invitación ya no está disponible.",
    };
  }

  if (!inviteMatchesUser(invitacion, userId, email)) {
    return {
      ok: false,
      code: "forbidden",
      message: "Esta invitación no corresponde a tu cuenta.",
    };
  }

  const activeFamilia = await getUserActiveFamilia(admin, userId);
  if (activeFamilia) {
    if (activeFamilia.familia_id === invitacion.familia_id) {
      return {
        ok: true,
        code: "already_active",
        message: "Ya formas parte de un grupo familiar.",
        familia_nombre: activeFamilia.familias?.nombre ?? familiaNombre,
      };
    }
    return {
      ok: false,
      code: "already_in_family",
      message:
        "Ya formas parte de otro grupo familiar. Solo puedes pertenecer a uno.",
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("familia_miembros")
    .update({
      perfil_id: userId,
      estado: "activo",
      email_invitado: null,
    })
    .eq("id", invitacionId)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "error", message: updateError.message };
  }

  if (!updated) {
    const { data: recheck } = await admin
      .from("familia_miembros")
      .select("estado, perfil_id")
      .eq("id", invitacionId)
      .maybeSingle();

    if (recheck?.estado === "activo" && recheck.perfil_id === userId) {
      return {
        ok: true,
        code: "already_active",
        message: "Ya formas parte de este grupo familiar.",
        familia_nombre: familiaNombre,
      };
    }

    return {
      ok: false,
      code: "conflict",
      message: "No se pudo aceptar la invitación.",
    };
  }

  return {
    ok: true,
    code: "accepted",
    message: `Te has unido al grupo familiar de ${familiaNombre}.`,
    familia_nombre: familiaNombre,
  };
}
