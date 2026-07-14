import { createClient } from "@supabase/supabase-js";
import { sequences } from "@/app/lib/email-sequences";
import { resolverEmailUsuario } from "@/app/lib/email-usuario";

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

/** role=proveedor y onboarding sin completar */
async function isProveedorOnboardingPendiente(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("role, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  return data?.role === "proveedor" && !data?.onboarding_completed_at;
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

export async function runEmailSequences() {
  const stats = {
    cliente_activacion: 0,
    cliente_primera_reserva: 0,
    cliente_reactivacion: 0,
    proveedor_sin_actividad: 0,
    proveedor_onboarding_pendiente_1: 0,
    proveedor_onboarding_pendiente_2: 0,
    errors: [],
  };

  const w24h = windowIso(48, 24);
  const { data: activacionUsers } = await supabase
    .from("profiles")
    .select("id, nombre, fecha_registro")
    .neq("role", "proveedor")
    .gte("fecha_registro", w24h.from)
    .lte("fecha_registro", w24h.to);

  for (const user of activacionUsers || []) {
    if (await alreadySent(user.id, "cliente_activacion")) continue;
    if (await userHasBookings(user.id, true)) continue;

    const email = await resolverEmailUsuario(user.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${user.id}, skip cliente_activacion`,
      );
      continue;
    }

    try {
      await sendSequenceEmail({
        tipo: "cliente_activacion",
        user_id: user.id,
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
    .select("id, nombre, fecha_registro")
    .neq("role", "proveedor")
    .gte("fecha_registro", w3d.from)
    .lte("fecha_registro", w3d.to);

  for (const user of primeraReservaUsers || []) {
    if (await alreadySent(user.id, "cliente_primera_reserva")) continue;
    if (await userHasBookings(user.id, true)) continue;

    const email = await resolverEmailUsuario(user.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${user.id}, skip cliente_primera_reserva`,
      );
      continue;
    }

    try {
      await sendSequenceEmail({
        tipo: "cliente_primera_reserva",
        user_id: user.id,
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
    .select("id, nombre, fecha_registro")
    .neq("role", "proveedor")
    .lte("fecha_registro", hace30d);

  for (const user of clientes || []) {
    if (await alreadySent(user.id, "cliente_reactivacion")) continue;

    const email = await resolverEmailUsuario(user.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${user.id}, skip cliente_reactivacion`,
      );
      continue;
    }

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
        user_id: user.id,
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
      .select("id, nombre, role, verificado")
      .eq("id", log.user_id)
      .maybeSingle();

    if (!proveedor?.verificado) continue;
    if (await alreadySent(proveedor.id, "proveedor_sin_actividad")) continue;
    if (await userHasBookings(proveedor.id, false)) continue;

    const email = await resolverEmailUsuario(proveedor.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${proveedor.id}, skip proveedor_sin_actividad`,
      );
      continue;
    }

    try {
      await sendSequenceEmail({
        tipo: "proveedor_sin_actividad",
        user_id: proveedor.id,
        nombre: proveedor.nombre,
      });
      await logSent(proveedor.id, "proveedor_sin_actividad");
      stats.proveedor_sin_actividad += 1;
    } catch (err) {
      stats.errors.push(`proveedor_sin_actividad:${proveedor.id}:${err.message}`);
    }
  }

  const wOnboarding24h = windowIso(48, 24);
  const { data: onboardingPendienteUsers } = await supabase
    .from("profiles")
    .select("id, nombre, onboarding_started_at")
    .eq("role", "proveedor")
    .is("onboarding_completed_at", null)
    .not("onboarding_started_at", "is", null)
    .gte("onboarding_started_at", wOnboarding24h.from)
    .lte("onboarding_started_at", wOnboarding24h.to);

  for (const user of onboardingPendienteUsers || []) {
    if (await alreadySent(user.id, "proveedor_onboarding_pendiente_1")) continue;
    if (!(await isProveedorOnboardingPendiente(user.id))) continue;

    const email = await resolverEmailUsuario(user.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${user.id}, skip proveedor_onboarding_pendiente_1`,
      );
      continue;
    }

    try {
      await sendSequenceEmail({
        tipo: "proveedor_onboarding_pendiente_1",
        user_id: user.id,
        nombre: user.nombre,
      });
      await logSent(user.id, "proveedor_onboarding_pendiente_1");
      stats.proveedor_onboarding_pendiente_1 += 1;
    } catch (err) {
      stats.errors.push(
        `proveedor_onboarding_pendiente_1:${user.id}:${err.message}`,
      );
    }
  }

  const hace4d = new Date(Date.now() - 4 * DAY_MS).toISOString();
  const { data: onboardingEmail1Logs } = await supabase
    .from("email_logs")
    .select("user_id, enviado_at")
    .eq("tipo", "proveedor_onboarding_pendiente_1")
    .lte("enviado_at", hace4d);

  for (const log of onboardingEmail1Logs || []) {
    if (await alreadySent(log.user_id, "proveedor_onboarding_pendiente_2")) {
      continue;
    }
    if (!(await isProveedorOnboardingPendiente(log.user_id))) continue;

    const { data: proveedor } = await supabase
      .from("profiles")
      .select("id, nombre")
      .eq("id", log.user_id)
      .maybeSingle();

    if (!proveedor) continue;

    const email = await resolverEmailUsuario(proveedor.id);
    if (!email) {
      console.warn(
        `[email-sequences] Sin email para ${proveedor.id}, skip proveedor_onboarding_pendiente_2`,
      );
      continue;
    }

    try {
      await sendSequenceEmail({
        tipo: "proveedor_onboarding_pendiente_2",
        user_id: proveedor.id,
        nombre: proveedor.nombre,
      });
      await logSent(proveedor.id, "proveedor_onboarding_pendiente_2");
      stats.proveedor_onboarding_pendiente_2 += 1;
    } catch (err) {
      stats.errors.push(
        `proveedor_onboarding_pendiente_2:${proveedor.id}:${err.message}`,
      );
    }
  }

  return { stats, sequences: Object.keys(sequences) };
}
