import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expandDisponibilidadAFechas } from "@/app/lib/tarifas";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  return { user, response: null };
}

async function assertServiceOwnedByUser(serviceId, userId) {
  if (!serviceId || typeof serviceId !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Falta service_id" }, { status: 400 }),
    };
  }

  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("proveedor_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
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

  return { ok: true, response: null };
}

export async function GET(request) {
  const { user, response: authResponse } = await getAuthenticatedUser();
  if (authResponse) return authResponse;

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json(
      { error: "Faltan parámetros desde y hasta" },
      { status: 400 },
    );
  }

  if (!isValidFecha(desde) || !isValidFecha(hasta)) {
    return NextResponse.json(
      { error: "Formato de fecha inválido (usa YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const ownership = await assertServiceOwnedByUser(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  const { data, error } = await supabaseAdmin
    .from("service_tarifas")
    .select("fecha, precio")
    .eq("service_id", serviceId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tarifas = (data ?? []).map((row) => ({
    fecha:
      typeof row.fecha === "string" ? row.fecha.slice(0, 10) : row.fecha,
    precio: Number(row.precio),
  }));

  const { data: bloqueos, error: bloqueosError } = await supabaseAdmin
    .from("disponibilidad")
    .select("fecha_inicio, fecha_fin")
    .eq("service_id", serviceId)
    .lte("fecha_inicio", hasta)
    .gte("fecha_fin", desde);

  if (bloqueosError) {
    return NextResponse.json({ error: bloqueosError.message }, { status: 500 });
  }

  const ocupadas = expandDisponibilidadAFechas(bloqueos, desde, hasta);

  return NextResponse.json({ tarifas, ocupadas });
}

export async function POST(request) {
  const { user, response: authResponse } = await getAuthenticatedUser();
  if (authResponse) return authResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const serviceId = body?.service_id;
  const tarifasInput = body?.tarifas;

  if (!Array.isArray(tarifasInput) || tarifasInput.length === 0) {
    return NextResponse.json(
      { error: "tarifas debe ser un array no vacío" },
      { status: 400 },
    );
  }

  const ownership = await assertServiceOwnedByUser(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  const rows = [];
  for (const item of tarifasInput) {
    const fecha = normalizeFecha(item?.fecha);
    const precio = Number(item?.precio);

    if (!fecha) {
      return NextResponse.json(
        { error: "Cada fecha debe tener formato YYYY-MM-DD válido" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      return NextResponse.json(
        { error: "Cada precio debe ser un número mayor que 0" },
        { status: 400 },
      );
    }

    rows.push({
      service_id: serviceId,
      fecha,
      precio,
      updated_at: new Date().toISOString(),
    });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("service_tarifas")
    .upsert(rows, { onConflict: "service_id,fecha" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { user, response: authResponse } = await getAuthenticatedUser();
  if (authResponse) return authResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const serviceId = body?.service_id;
  const fechasInput = body?.fechas;

  if (!Array.isArray(fechasInput) || fechasInput.length === 0) {
    return NextResponse.json(
      { error: "fechas debe ser un array no vacío" },
      { status: 400 },
    );
  }

  const fechas = [];
  for (const raw of fechasInput) {
    const fecha = normalizeFecha(raw);
    if (!fecha) {
      return NextResponse.json(
        { error: "Cada fecha debe tener formato YYYY-MM-DD válido" },
        { status: 400 },
      );
    }
    fechas.push(fecha);
  }

  const ownership = await assertServiceOwnedByUser(serviceId, user.id);
  if (!ownership.ok) return ownership.response;

  const { error: deleteError } = await supabaseAdmin
    .from("service_tarifas")
    .delete()
    .eq("service_id", serviceId)
    .in("fecha", fechas);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
