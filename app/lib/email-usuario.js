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
