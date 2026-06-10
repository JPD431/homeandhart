// -- CREATE TABLE familias (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   nombre text NOT NULL,
// --   creador_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
// --   created_at timestamp with time zone DEFAULT now()
// -- );
// -- CREATE TABLE familia_miembros (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   familia_id uuid REFERENCES familias(id) ON DELETE CASCADE,
// --   perfil_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
// --   rol text DEFAULT 'miembro',
// --   created_at timestamp with time zone DEFAULT now(),
// --   UNIQUE(familia_id, perfil_id)
// -- );
// -- ALTER TABLE familia_miembros ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo';
// -- ALTER TABLE familia_miembros ADD COLUMN IF NOT EXISTS email_invitado text;
// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS familia_id uuid REFERENCES familias(id);

export function getFamiliaInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export async function getUserFamiliaActiva(supabase, userId) {
  const { data: membership } = await supabase
    .from("familia_miembros")
    .select(
      `
      id,
      rol,
      estado,
      familia_id,
      familias (
        id,
        nombre,
        creador_id
      )
    `,
    )
    .eq("perfil_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  if (!membership?.familias) return null;

  return {
    membershipId: membership.id,
    rol: membership.rol,
    familia: membership.familias,
  };
}

export async function getFamiliaMiembros(supabase, familiaId) {
  const { data } = await supabase
    .from("familia_miembros")
    .select(
      `
      id,
      rol,
      estado,
      email_invitado,
      perfil_id,
      profiles:perfil_id (
        nombre,
        apellido,
        foto_perfil,
        email_contacto
      )
    `,
    )
    .eq("familia_id", familiaId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function countFamiliaReservas(supabase, familiaId) {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("familia_id", familiaId);

  return count ?? 0;
}
