import { createClient } from "@supabase/supabase-js";

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
  const map = {};
  for (const review of reviews ?? []) {
    if (!map[review.proveedor_id]) {
      map[review.proveedor_id] = { sum: 0, count: 0 };
    }
    map[review.proveedor_id].sum += Number(review.valoracion);
    map[review.proveedor_id].count += 1;
  }
  const averages = {};
  for (const [id, { sum, count }] of Object.entries(map)) {
    averages[id] = count > 0 ? sum / count : 0;
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
        proveedor_id,
        profiles:proveedor_id (
          nombre,
          apellido,
          foto_perfil,
          avatar_url
        )
      `,
      )
      .eq("vertical", vertical)
      .eq("disponible", true)
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
      .select("proveedor_id, valoracion")
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
          svc.foto_url ||
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
