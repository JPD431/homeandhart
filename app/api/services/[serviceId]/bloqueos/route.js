import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { expandDisponibilidadAFechas } from "@/app/lib/tarifas";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIPO_BLOQUEO = "bloqueo_manual";
const TIPO_RESERVA = "reserva";

function isValidFecha(fecha) {
  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) return false;
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function normalizeFecha(value) {
  if (typeof value !== "string") return null;
  const fecha = value.slice(0, 10);
  return isValidFecha(fecha) ? fecha : null;
}

function isExclusionError(error) {
  if (!error) return false;
  if (error.code === "23P01") return true;
  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");
  return text.includes("disponibilidad_sin_solapamiento");
}

async function assertOwner(serviceId, userId) {
  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!service) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 }),
    };
  }
  if (service.proveedor_id !== userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { ok: true, service };
}

/**
 * GET /api/services/[serviceId]/bloqueos?desde=&hasta=
 * Devuelve fechas ocupadas por reserva y por bloqueo manual.
 */
export async function GET(request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ownership = await assertOwner(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta || !isValidFecha(desde) || !isValidFecha(hasta)) {
    return NextResponse.json(
      { error: "Faltan desde/hasta válidos (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("disponibilidad")
    .select("id, fecha_inicio, fecha_fin, booking_id, tipo")
    .eq("service_id", serviceId)
    .lte("fecha_inicio", hasta)
    .gte("fecha_fin", desde);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reservas = [];
  const bloqueos = [];
  for (const row of data ?? []) {
    const tipo = row.tipo === TIPO_BLOQUEO ? TIPO_BLOQUEO : TIPO_RESERVA;
    if (tipo === TIPO_BLOQUEO) bloqueos.push(row);
    else reservas.push(row);
  }

  return NextResponse.json({
    ocupadas: expandDisponibilidadAFechas(reservas, desde, hasta),
    bloqueadas: expandDisponibilidadAFechas(bloqueos, desde, hasta),
    rows: (data ?? []).map((r) => ({
      id: r.id,
      fecha_inicio:
        typeof r.fecha_inicio === "string"
          ? r.fecha_inicio.slice(0, 10)
          : r.fecha_inicio,
      fecha_fin:
        typeof r.fecha_fin === "string" ? r.fecha_fin.slice(0, 10) : r.fecha_fin,
      tipo: r.tipo === TIPO_BLOQUEO ? TIPO_BLOQUEO : TIPO_RESERVA,
      booking_id: r.booking_id,
    })),
  });
}

/**
 * POST /api/services/[serviceId]/bloqueos
 * Body: { fecha } | { fechas: string[] } | { fecha_inicio, fecha_fin }
 */
export async function POST(request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ownership = await assertOwner(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const fechas = [];
  if (Array.isArray(body?.fechas)) {
    for (const raw of body.fechas) {
      const f = normalizeFecha(raw);
      if (!f) {
        return NextResponse.json(
          { error: "Cada fecha debe ser YYYY-MM-DD válida" },
          { status: 400 },
        );
      }
      fechas.push(f);
    }
  } else if (body?.fecha_inicio || body?.fecha_fin) {
    const inicio = normalizeFecha(body.fecha_inicio);
    const fin = normalizeFecha(body.fecha_fin || body.fecha_inicio);
    if (!inicio || !fin || fin < inicio) {
      return NextResponse.json(
        { error: "Rango de fechas inválido" },
        { status: 400 },
      );
    }
    let cur = inicio;
    while (cur <= fin) {
      fechas.push(cur);
      const [y, m, d] = cur.split("-").map(Number);
      const dt = new Date(y, m - 1, d + 1);
      cur = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }
  } else {
    const f = normalizeFecha(body?.fecha);
    if (!f) {
      return NextResponse.json(
        { error: "Falta fecha (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    fechas.push(f);
  }

  const uniqueFechas = [...new Set(fechas)].sort();
  if (uniqueFechas.length === 0) {
    return NextResponse.json({ error: "No hay fechas para bloquear" }, { status: 400 });
  }

  const rows = uniqueFechas.map((fecha) => ({
    service_id: serviceId,
    fecha_inicio: fecha,
    fecha_fin: fecha,
    booking_id: null,
    tipo: TIPO_BLOQUEO,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("disponibilidad")
    .insert(rows)
    .select("id, fecha_inicio, fecha_fin, tipo, booking_id");

  if (insertError) {
    if (isExclusionError(insertError)) {
      return NextResponse.json(
        {
          error:
            "No puedes bloquear una fecha que ya tiene una reserva",
          code: "fecha_con_reserva",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: verified, error: verifyError } = await supabaseAdmin
    .from("disponibilidad")
    .select("id, fecha_inicio, fecha_fin, tipo, booking_id")
    .eq("service_id", serviceId)
    .eq("tipo", TIPO_BLOQUEO)
    .in(
      "fecha_inicio",
      uniqueFechas,
    );

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  const verifiedFechas = new Set(
    (verified ?? []).map((r) =>
      typeof r.fecha_inicio === "string"
        ? r.fecha_inicio.slice(0, 10)
        : r.fecha_inicio,
    ),
  );
  const missing = uniqueFechas.filter((f) => !verifiedFechas.has(f));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "La base de datos no confirmó todos los bloqueos",
        missing,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    bloqueadas: uniqueFechas,
    rows: inserted ?? verified,
  });
}

/**
 * DELETE /api/services/[serviceId]/bloqueos
 * Body: { fecha } | { fechas: string[] }
 * Solo elimina tipo bloqueo_manual.
 */
export async function DELETE(request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ownership = await assertOwner(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const fechas = [];
  if (Array.isArray(body?.fechas)) {
    for (const raw of body.fechas) {
      const f = normalizeFecha(raw);
      if (!f) {
        return NextResponse.json(
          { error: "Cada fecha debe ser YYYY-MM-DD válida" },
          { status: 400 },
        );
      }
      fechas.push(f);
    }
  } else {
    const f = normalizeFecha(body?.fecha);
    if (!f) {
      return NextResponse.json(
        { error: "Falta fecha (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    fechas.push(f);
  }

  const uniqueFechas = [...new Set(fechas)];

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from("disponibilidad")
    .delete()
    .eq("service_id", serviceId)
    .eq("tipo", TIPO_BLOQUEO)
    .is("booking_id", null)
    .in("fecha_inicio", uniqueFechas)
    .select("id, fecha_inicio");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { data: stillThere } = await supabaseAdmin
    .from("disponibilidad")
    .select("id")
    .eq("service_id", serviceId)
    .eq("tipo", TIPO_BLOQUEO)
    .in("fecha_inicio", uniqueFechas)
    .limit(1);

  if ((stillThere ?? []).length > 0) {
    return NextResponse.json(
      { error: "No se pudieron eliminar todos los bloqueos en BD" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    eliminadas: (deleted ?? []).map((r) =>
      typeof r.fecha_inicio === "string"
        ? r.fecha_inicio.slice(0, 10)
        : r.fecha_inicio,
    ),
  });
}
