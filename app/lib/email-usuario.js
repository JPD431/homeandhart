import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function resolverEmailUsuario(userId) {
  if (!userId) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (!authError && authData?.user?.email) {
    return authData.user.email;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_contacto")
    .eq("id", userId)
    .maybeSingle();

  return profile?.email_contacto || null;
}

export async function resolverNombreUsuario(userId) {
  if (!userId) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;
  return [profile.nombre, profile.apellido].filter(Boolean).join(" ") || null;
}

/**
 * Busca un usuario en auth.users por email (no en profiles).
 * Usa auth.admin.listUsers paginado — no hay getUserByEmail en el SDK v2.
 */
export async function resolverUserIdPorEmail(email) {
  if (!email) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("[resolverUserIdPorEmail] listUsers error:", error.message);
      return null;
    }

    const match = data.users.find(
      (u) => u.email?.trim().toLowerCase() === normalized,
    );
    if (match) return match.id;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}
