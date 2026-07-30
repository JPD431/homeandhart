import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import {
  SERVICE_BURST_ALERT_THRESHOLD,
  SERVICE_BURST_WINDOW_MS,
} from "@/app/lib/service-limits";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/services/creation-burst-check
 * Si el proveedor autenticado creó >N servicios en 24h → email admin (aviso, no bloqueo).
 * Idempotente ~1 email/día vía email_logs (tipo fijo + proveedor).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const since = new Date(Date.now() - SERVICE_BURST_WINDOW_MS).toISOString();

  const { data: recent, error: recentError } = await supabaseAdmin
    .from("services")
    .select("id, created_at")
    .eq("proveedor_id", user.id)
    .gte("created_at", since);

  if (recentError) {
    console.error(
      "[creation-burst-check] Error contando recientes:",
      recentError.message,
    );
    return NextResponse.json({ error: recentError.message }, { status: 500 });
  }

  const count24h = recent?.length ?? 0;
  if (count24h <= SERVICE_BURST_ALERT_THRESHOLD) {
    return NextResponse.json({
      ok: true,
      alerted: false,
      count_24h: count24h,
    });
  }

  const { count: totalServices } = await supabaseAdmin
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("proveedor_id", user.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido")
    .eq("id", user.id)
    .maybeSingle();

  const nombre =
    [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() ||
    "Proveedor";

  // Dedup diario: no spamear admin si ya avisamos hoy por este proveedor.
  const dayKey = new Date().toISOString().slice(0, 10);
  const dedupeTipo = "admin_servicios_creacion_masiva";
  const { data: already } = await supabaseAdmin
    .from("email_logs")
    .select("id")
    .eq("tipo", dedupeTipo)
    .eq("user_id", user.id)
    .gte("created_at", `${dayKey}T00:00:00.000Z`)
    .limit(1);

  if (already?.length) {
    return NextResponse.json({
      ok: true,
      alerted: false,
      reason: "already_today",
      count_24h: count24h,
    });
  }

  const result = await sendPlatformEmail({
    tipo: dedupeTipo,
    proveedor_id: user.id,
    nombre,
    count_24h: count24h,
    total_services: totalServices ?? 0,
  });

  if (!result.ok) {
    console.error(
      "[creation-burst-check] Email falló:",
      result.error || result.status,
    );
    return NextResponse.json({
      ok: true,
      alerted: false,
      reason: "email_fail",
      count_24h: count24h,
    });
  }

  // Dedup diario (mismo esquema que secuencias: user_id + tipo).
  try {
    await supabaseAdmin.from("email_logs").insert({
      tipo: dedupeTipo,
      user_id: user.id,
    });
  } catch (logErr) {
    console.error(
      "[creation-burst-check] email_logs insert:",
      logErr?.message || logErr,
    );
  }

  return NextResponse.json({
    ok: true,
    alerted: true,
    count_24h: count24h,
  });
}
