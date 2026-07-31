import { createClient } from "@supabase/supabase-js";
import { getServiceCoverPhoto } from "@/app/lib/service-card-display";
import { aggregateRatingsByProveedor } from "@/app/lib/reviews";

export { isCancelacionTardia } from "./is-cancelacion-tardia";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan credenciales Supabase (service role)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function hasDisponibilidad(supabase, serviceId, fechaInicio, fechaFin) {
  const fin = fechaFin || fechaInicio;
  const { data } = await supabase
    .from("disponibilidad")
    .select("id")
    .eq("service_id", serviceId)
    .lte("fecha_inicio", fin)
    .gte("fecha_fin", fechaInicio);

  return (data?.length ?? 0) === 0;
}

function getAverageRatings(reviews) {
  const aggregated = aggregateRatingsByProveedor(reviews);
  const averages = {};
  for (const [id, rating] of Object.entries(aggregated)) {
    averages[id] = rating.avg ?? 0;
  }
  return averages;
}

/**
 * Busca hasta 3 alternativas de emergencia (garantía 30 min) para un cliente.
 * In-process — no hacer fetch HTTP a /api/garantia.
 *
 * @param {object} opts
 * @param {string} [opts.service_id] — servicio a excluir
 * @param {string} opts.fecha_inicio
 * @param {string} [opts.fecha_fin]
 * @param {string} opts.vertical
 * @param {string} opts.ciudad
 * @returns {Promise<{ ok: true, alternativas: object[] } | { ok: false, error: string }>}
 */
export async function buscarAlternativasGarantia({
  service_id = null,
  fecha_inicio,
  fecha_fin = null,
  vertical,
  ciudad,
} = {}) {
  if (!vertical || !ciudad || !fecha_inicio) {
    return { ok: false, error: "Faltan datos para buscar alternativas" };
  }

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("services")
      .select(
        `
        id,
        titulo,
        precio,
        vertical,
        ciudad,
        foto_url,
        fotos,
        proveedor_id,
        profiles:proveedor_id!inner (
          nombre,
          apellido,
          foto_perfil,
          verificado
        )
      `,
      )
      .eq("vertical", vertical)
      .eq("disponible", true)
      .eq("profiles.verificado", true)
      .eq("proveedor_emergencia", true)
      .ilike("ciudad", `%${ciudad}%`);

    if (service_id) {
      query = query.neq("id", service_id);
    }

    const { data: candidates, error } = await query;

    if (error) {
      return { ok: false, error: error.message };
    }

    const available = [];
    for (const svc of candidates ?? []) {
      const libre = await hasDisponibilidad(
        supabase,
        svc.id,
        fecha_inicio,
        fecha_fin || fecha_inicio,
      );
      if (libre) available.push(svc);
    }

    if (available.length === 0) {
      return { ok: true, alternativas: [] };
    }

    const proveedorIds = [
      ...new Set(available.map((s) => s.proveedor_id).filter(Boolean)),
    ];

    const { data: reviews } = await supabase
      .from("reviews")
      .select("proveedor_id, valoracion, cliente_id")
      .in("proveedor_id", proveedorIds);

    const avgRatings = getAverageRatings(reviews);
    const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

    const alternativas = available
      .map((svc) => ({
        ...svc,
        valoracion_media: avgRatings[svc.proveedor_id] ?? 0,
        precio_emergencia: Number(svc.precio || 0) * 1.05,
      }))
      .filter((svc) => svc.valoracion_media >= 4.0)
      .sort((a, b) => b.valoracion_media - a.valoracion_media)
      .slice(0, 3)
      .map((svc) => {
        const proveedor = svc.profiles ?? {};
        const nombre =
          [proveedor.nombre, proveedor.apellido].filter(Boolean).join(" ") ||
          "Proveedor";
        const foto =
          getServiceCoverPhoto(svc) ||
          proveedor.foto_perfil ||
          proveedor.avatar_url ||
          null;

        return {
          service_id: svc.id,
          titulo: svc.titulo || "Servicio",
          proveedor_nombre: nombre,
          foto_url: foto,
          precio: svc.precio_emergencia,
          valoracion: svc.valoracion_media.toFixed(1),
          reservar_url: `${baseUrl}/reservar/${svc.id}`,
        };
      });

    return { ok: true, alternativas };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "Error al buscar alternativas",
    };
  }
}

/**
 * @deprecated Usa POST /api/bookings/cancelar-cliente desde el cliente.
 * Wrapper de compatibilidad que delega en el endpoint del servidor.
 */
export async function procesarCancelacionTardia({ bookingId }) {
  const res = await fetch("/api/bookings/cancelar-cliente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "No se pudo cancelar la reserva",
    };
  }

  return {
    ok: true,
    estado: data.estado,
    reembolso: data.reembolso,
  };
}
