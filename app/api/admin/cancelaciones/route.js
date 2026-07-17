import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/**
 * GET /api/admin/cancelaciones?filtro=todas|activas|exentas&limit=
 */
export async function GET(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const filtro = searchParams.get("filtro") || "activas";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  let query = supabaseAdmin
    .from("cancelaciones")
    .select(
      `
      id,
      booking_id,
      usuario_id,
      rol_cancelador,
      motivo,
      es_fuerza_mayor,
      exenta,
      exenta_por,
      exenta_at,
      nota_admin,
      created_at,
      profiles:usuario_id (
        nombre,
        apellido
      ),
      bookings:booking_id (
        fecha_inicio,
        fecha_fin,
        estado,
        precio_total,
        services:service_id (
          titulo,
          vertical
        )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filtro === "activas") {
    query = query.eq("exenta", false);
  } else if (filtro === "exentas") {
    query = query.eq("exenta", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const perfil = row.profiles ?? {};
    const booking = row.bookings ?? {};
    const service = booking.services ?? {};
    const nombre =
      [perfil.nombre, perfil.apellido].filter(Boolean).join(" ").trim() ||
      "Usuario";

    return {
      id: row.id,
      booking_id: row.booking_id,
      usuario_id: row.usuario_id,
      usuario_nombre: nombre,
      rol_cancelador: row.rol_cancelador,
      motivo: row.motivo,
      es_fuerza_mayor: row.es_fuerza_mayor === true,
      exenta: row.exenta === true,
      exenta_por: row.exenta_por,
      exenta_at: row.exenta_at,
      nota_admin: row.nota_admin,
      created_at: row.created_at,
      booking_estado: booking.estado ?? null,
      fecha_inicio: booking.fecha_inicio ?? null,
      fecha_fin: booking.fecha_fin ?? null,
      precio_total: booking.precio_total ?? null,
      servicio_titulo: service.titulo ?? null,
      vertical: service.vertical ?? null,
    };
  });

  const [activasRes, exentasRes, totalRes] = await Promise.all([
    supabaseAdmin
      .from("cancelaciones")
      .select("id", { count: "exact", head: true })
      .eq("exenta", false),
    supabaseAdmin
      .from("cancelaciones")
      .select("id", { count: "exact", head: true })
      .eq("exenta", true),
    supabaseAdmin
      .from("cancelaciones")
      .select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    cancelaciones: rows,
    meta: {
      filtro,
      limit,
      activas: activasRes.count ?? 0,
      exentas: exentasRes.count ?? 0,
      total: totalRes.count ?? 0,
    },
  });
}
