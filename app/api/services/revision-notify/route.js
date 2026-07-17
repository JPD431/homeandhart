import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { REVISION_EN_REVISION } from "@/app/lib/onboarding-persist";
import { notifyAdminsServicioPendiente } from "@/app/lib/service-revision-notify";

/**
 * POST /api/services/revision-notify
 * Body: { service_id } | { service_ids: string[] }
 * El proveedor autenticado avisa a admins de sus servicios en_revision.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const ids = [];
    if (typeof body?.service_id === "string" && body.service_id.trim()) {
      ids.push(body.service_id.trim());
    }
    if (Array.isArray(body?.service_ids)) {
      for (const id of body.service_ids) {
        if (typeof id === "string" && id.trim()) ids.push(id.trim());
      }
    }

    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "Falta service_id" }, { status: 400 });
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const { data: owned, error: ownedError } = await admin
      .from("services")
      .select("id, revision_estado")
      .eq("proveedor_id", user.id)
      .in("id", uniqueIds);

    if (ownedError) {
      return NextResponse.json({ error: ownedError.message }, { status: 500 });
    }

    const pendingIds = (owned ?? [])
      .filter((s) => s.revision_estado === REVISION_EN_REVISION)
      .map((s) => s.id);

    const results = [];
    for (const serviceId of pendingIds) {
      const result = await notifyAdminsServicioPendiente(serviceId);
      results.push({ service_id: serviceId, ...result });
    }

    return NextResponse.json({
      success: true,
      notified: results.some((r) => r.notified),
      results,
    });
  } catch (err) {
    console.error("[services/revision-notify]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Error al notificar" },
      { status: 500 },
    );
  }
}
