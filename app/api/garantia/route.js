import { createClient } from "@supabase/supabase-js";
import { getServiceCoverPhoto } from "@/app/lib/service-card-display";
import { aggregateRatingsByProveedor } from "@/app/lib/reviews";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function hasDisponibilidad(serviceId, fechaInicio, fechaFin) {
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { service_id, fecha_inicio, fecha_fin, vertical, ciudad } = body;

    if (!vertical || !ciudad || !fecha_inicio) {
      return Response.json(
        { error: "Faltan datos para buscar alternativas" },
        { status: 400 },
      );
    }

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
      return Response.json({ error: error.message }, { status: 500 });
    }

    const available = [];
    for (const svc of candidates ?? []) {
      const libre = await hasDisponibilidad(svc.id, fecha_inicio, fecha_fin);
      if (libre) available.push(svc);
    }

    if (available.length === 0) {
      return Response.json({ alternativas: [] });
    }

    const proveedorIds = [
      ...new Set(available.map((s) => s.proveedor_id).filter(Boolean)),
    ];

    const { data: reviews } = await supabase
      .from("reviews")
      .select("proveedor_id, valoracion, cliente_id")
      .in("proveedor_id", proveedorIds);

    const avgRatings = getAverageRatings(reviews);

    const rated = available
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
          reservar_url: `${process.env.NEXT_PUBLIC_URL || ""}/reservar/${svc.id}`,
        };
      });

    return Response.json({ alternativas: rated });
  } catch (err) {
    return Response.json(
      { error: err.message || "Error al buscar alternativas" },
      { status: 500 },
    );
  }
}
