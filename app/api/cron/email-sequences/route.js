import { createClient } from "@supabase/supabase-js";
import { sequences } from "@/app/lib/email-sequences";

// -- CREATE TABLE email_logs (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   user_id uuid REFERENCES profiles(id),
// --   tipo text NOT NULL,
// --   enviado_at timestamp with time zone DEFAULT now()
// -- );

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

function windowIso(hoursAgoStart, hoursAgoEnd) {
  const now = Date.now();
  return {
    from: new Date(now - hoursAgoStart * 60 * 60 * 1000).toISOString(),
    to: new Date(now - hoursAgoEnd * 60 * 60 * 1000).toISOString(),
  };
}

async function alreadySent(userId, tipo) {
  const { data } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .maybeSingle();

  return Boolean(data);
}

async function logSent(userId, tipo) {
  await supabase.from("email_logs").insert({ user_id: userId, tipo });
}

async function sendSequenceEmail(payload) {
  const response = await fetch(`${BASE_URL}/api/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Email failed: ${response.status}`);
  }

  return response.json();
}

async function userHasBookings(userId, asClient = true) {
  if (asClient) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", userId);

    return (count || 0) > 0;
  }

  const { data: services } = await supabase
    .from("services")
    .select("id")
    .eq("proveedor_id", userId);

  if (!services?.length) return false;

  const serviceIds = services.map((s) => s.id);
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("service_id", serviceIds);

  return (count || 0) > 0;
}

async function fetchFeaturedProviders(limit = 3) {
  const { data: services } = await supabase
    .from("services")
    .select(
      "id, titulo, precio, vertical, proveedor_id, profiles!proveedor_id(nombre, apellido, foto_perfil, verificado)",
    )
    .order("precio", { ascending: true })
    .limit(limit * 6);

  const seen = new Set();
  const result = [];

  for (const svc of services || []) {
    if (seen.has(svc.proveedor_id)) continue;
    const profile = svc.profiles;
    if (!profile?.verificado) continue;
    seen.add(svc.proveedor_id);
    const suffix =
      svc.vertical === "alojamiento"
        ? "/ noche"
        : svc.vertical === "ninos"
          ? "/ hora"
          : "/ día";
    result.push({
      nombre: [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || "Proveedor",
      precio: svc.precio,
      precio_label: svc.precio != null ? `${svc.precio}€${suffix}` : "Consultar",
      foto_url: profile?.foto_perfil || null,
      vertical: svc.vertical,
      titulo: svc.titulo,
    });
    if (result.length >= limit) break;
  }

  return result;
}

async function countNewProvidersSince(sinceIso) {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "proveedor")
    .eq("verificado", true)
    .gte("fecha_registro", sinceIso);

  return count || 0;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = {
    cliente_activacion: 0,
    cliente_primera_reserva: 0,
    cliente_reactivacion: 0,
    proveedor_sin_actividad: 0,
    errors: [],
  };

  try {
    const w24h = windowIso(48, 24);
    const { data: activacionUsers } = await supabase
      .from("profiles")
      .select("id, nombre, email_contacto, fecha_registro")
      .neq("role", "proveedor")
      .gte("fecha_registro", w24h.from)
      .lte("fecha_registro", w24h.to);

    for (const user of activacionUsers || []) {
      if (!user.email_contacto) continue;
      if (await alreadySent(user.id, "cliente_activacion")) continue;
      if (await userHasBookings(user.id, true)) continue;

      try {
        await sendSequenceEmail({
          tipo: "cliente_activacion",
          email: user.email_contacto,
          nombre: user.nombre,
        });
        await logSent(user.id, "cliente_activacion");
        stats.cliente_activacion += 1;
      } catch (err) {
        stats.errors.push(`cliente_activacion:${user.id}:${err.message}`);
      }
    }

    const w3d = windowIso(24 * 4, 24 * 3);
    const { data: primeraReservaUsers } = await supabase
      .from("profiles")
      .select("id, nombre, email_contacto, fecha_registro")
      .neq("role", "proveedor")
      .gte("fecha_registro", w3d.from)
      .lte("fecha_registro", w3d.to);

    for (const user of primeraReservaUsers || []) {
      if (!user.email_contacto) continue;
      if (await alreadySent(user.id, "cliente_primera_reserva")) continue;
      if (await userHasBookings(user.id, true)) continue;

      try {
        await sendSequenceEmail({
          tipo: "cliente_primera_reserva",
          email: user.email_contacto,
          nombre: user.nombre,
        });
        await logSent(user.id, "cliente_primera_reserva");
        stats.cliente_primera_reserva += 1;
      } catch (err) {
        stats.errors.push(`cliente_primera_reserva:${user.id}:${err.message}`);
      }
    }

    const hace30d = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data: clientes } = await supabase
      .from("profiles")
      .select("id, nombre, email_contacto, fecha_registro")
      .neq("role", "proveedor")
      .lte("fecha_registro", hace30d);

    for (const user of clientes || []) {
      if (!user.email_contacto) continue;
      if (await alreadySent(user.id, "cliente_reactivacion")) continue;

      const { data: recentBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("cliente_id", user.id)
        .gte("created_at", hace30d)
        .limit(1)
        .maybeSingle();

      if (recentBooking) continue;

      const since =
        user.fecha_registro || new Date(Date.now() - 30 * DAY_MS).toISOString();
      const nuevosProveedores = await countNewProvidersSince(since);
      const proveedores = await fetchFeaturedProviders(3);

      try {
        await sendSequenceEmail({
          tipo: "cliente_reactivacion",
          email: user.email_contacto,
          nombre: user.nombre,
          nuevos_proveedores: nuevosProveedores,
          proveedores,
        });
        await logSent(user.id, "cliente_reactivacion");
        stats.cliente_reactivacion += 1;
      } catch (err) {
        stats.errors.push(`cliente_reactivacion:${user.id}:${err.message}`);
      }
    }

    const w7d = windowIso(24 * 8, 24 * 7);
    const { data: verificadosLogs } = await supabase
      .from("email_logs")
      .select("user_id, enviado_at")
      .eq("tipo", "proveedor_verificado")
      .gte("enviado_at", w7d.from)
      .lte("enviado_at", w7d.to);

    for (const log of verificadosLogs || []) {
      const { data: proveedor } = await supabase
        .from("profiles")
        .select("id, nombre, email_contacto, role, verificado")
        .eq("id", log.user_id)
        .maybeSingle();

      if (!proveedor?.email_contacto || !proveedor.verificado) continue;
      if (await alreadySent(proveedor.id, "proveedor_sin_actividad")) continue;
      if (await userHasBookings(proveedor.id, false)) continue;

      try {
        await sendSequenceEmail({
          tipo: "proveedor_sin_actividad",
          email: proveedor.email_contacto,
          nombre: proveedor.nombre,
        });
        await logSent(proveedor.id, "proveedor_sin_actividad");
        stats.proveedor_sin_actividad += 1;
      } catch (err) {
        stats.errors.push(`proveedor_sin_actividad:${proveedor.id}:${err.message}`);
      }
    }

    return Response.json({ success: true, stats, sequences: Object.keys(sequences) });
  } catch (err) {
    return Response.json(
      { error: err.message || "Error en cron email-sequences", stats },
      { status: 500 },
    );
  }
}
