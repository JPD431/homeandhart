import { buscarAlternativasGarantia } from "@/app/lib/garantia";

/**
 * POST /api/garantia
 * Busca alternativas de emergencia. Lógica en app/lib/garantia.js (in-process).
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const { service_id, fecha_inicio, fecha_fin, vertical, ciudad } = body ?? {};

    const result = await buscarAlternativasGarantia({
      service_id,
      fecha_inicio,
      fecha_fin,
      vertical,
      ciudad,
    });

    if (!result.ok) {
      const status = result.error?.includes("Faltan datos") ? 400 : 500;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ alternativas: result.alternativas });
  } catch (err) {
    return Response.json(
      { error: err.message || "Error al buscar alternativas" },
      { status: 500 },
    );
  }
}
