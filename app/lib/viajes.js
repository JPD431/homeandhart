// -- CREATE TABLE viajes (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   nombre text NOT NULL,
// --   familia_id uuid REFERENCES familias(id),
// --   creador_id uuid REFERENCES profiles(id),
// --   fecha_inicio date,
// --   fecha_fin date,
// --   ciudad text,
// --   created_at timestamp with time zone DEFAULT now()
// -- );
// -- CREATE TABLE viaje_reservas (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   viaje_id uuid REFERENCES viajes(id) ON DELETE CASCADE,
// --   booking_id uuid REFERENCES bookings(id),
// --   created_at timestamp with time zone DEFAULT now()
// -- );

export const VERTICAL_THEME = {
  alojamiento: { label: "Alojamiento", color: "#1d4f91", light: "#e8f0fb" },
  ninos: { label: "Cuidado de niños", color: "#0e7a5c", light: "#e6f4f0" },
  mascotas: { label: "Cuidado de mascotas", color: "#c47d1a", light: "#fdf3e3" },
};

export function getBookingEstado(booking) {
  return booking?.estado ?? booking?.status ?? "pendiente";
}

export function formatEuro(value) {
  if (value == null || value === "") return "—";
  return `${Number(value).toFixed(2)}€`;
}

export function parseDateStr(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateRange(inicio, fin) {
  if (!inicio) return "—";
  if (!fin || fin === inicio) return inicio;
  return `${inicio} — ${fin}`;
}

export function daysBetween(startStr, endStr) {
  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  if (!start || !end) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function addDays(dateStr, days) {
  const d = parseDateStr(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function buildTimelineItems(bookings, viajeCiudad) {
  const sorted = [...bookings].sort((a, b) => {
    const da = a.fecha_inicio || "";
    const db = b.fecha_inicio || "";
    return da.localeCompare(db);
  });

  const items = [];

  for (let i = 0; i < sorted.length; i++) {
    const booking = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevEnd = prev.fecha_fin || prev.fecha_inicio;
      const currStart = booking.fecha_inicio;
      if (prevEnd && currStart) {
        const gapStart = addDays(prevEnd, 1);
        const gapEnd = addDays(currStart, -1);
        if (gapStart <= gapEnd) {
          items.push({
            type: "gap",
            gapStart,
            gapEnd,
            ciudad: viajeCiudad,
          });
        }
      }
    }
    items.push({ type: "booking", booking });
  }

  return items;
}

export async function userCanAccessViaje(supabase, viaje, userId) {
  if (!viaje || !userId) return false;
  if (viaje.creador_id === userId) return true;
  if (!viaje.familia_id) return false;

  const { data } = await supabase
    .from("familia_miembros")
    .select("id")
    .eq("familia_id", viaje.familia_id)
    .eq("perfil_id", userId)
    .eq("estado", "activo")
    .maybeSingle();

  return !!data;
}

export async function loadUserViajes(supabase, userId, familiaId = null) {
  const hoy = new Date().toISOString().split("T")[0];
  let query = supabase
    .from("viajes")
    .select(
      `
      *,
      viaje_reservas (id)
    `,
    )
    .or(
      familiaId
        ? `creador_id.eq.${userId},familia_id.eq.${familiaId}`
        : `creador_id.eq.${userId}`,
    )
    .or(`fecha_fin.gte.${hoy},fecha_fin.is.null`)
    .order("fecha_inicio", { ascending: true });

  const { data, error } = await query;
  if (error) return { viajes: [], error: error.message };

  return {
    viajes: (data ?? []).map((v) => ({
      ...v,
      serviciosCount: v.viaje_reservas?.length ?? 0,
    })),
    error: null,
  };
}
