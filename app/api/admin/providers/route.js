import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("role", "proveedor")
    .order("fecha_registro", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const providerIds = (profiles || []).map((p) => p.id);

  let docsByProvider = {};
  let servicesByProvider = {};

  if (providerIds.length > 0) {
    const [docsResult, servicesResult] = await Promise.all([
      supabaseAdmin
        .from("provider_documents")
        .select("id, proveedor_id, tipo, vertical, url, created_at, updated_at")
        .in("proveedor_id", providerIds)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("services")
        .select(
          "id, proveedor_id, vertical, titulo, precio, ciudad, revision_estado, disponible, nru, nru_estado, nru_aprobado_at",
        )
        .in("proveedor_id", providerIds),
    ]);

    if (docsResult.error) {
      return NextResponse.json({ error: docsResult.error.message }, { status: 500 });
    }
    if (servicesResult.error) {
      return NextResponse.json({ error: servicesResult.error.message }, { status: 500 });
    }

    for (const row of docsResult.data ?? []) {
      if (!docsByProvider[row.proveedor_id]) docsByProvider[row.proveedor_id] = [];
      docsByProvider[row.proveedor_id].push(row);
    }

    for (const svc of servicesResult.data ?? []) {
      if (!servicesByProvider[svc.proveedor_id]) {
        servicesByProvider[svc.proveedor_id] = [];
      }
      servicesByProvider[svc.proveedor_id].push(svc);
    }
  }

  // Enriquecer con email de auth.users, documentos y servicios (NRU)
  const enriched = await Promise.all(
    (profiles || []).map(async (p) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(p.id);
      return {
        ...p,
        email_contacto: userData?.user?.email || null,
        providerDocuments: docsByProvider[p.id] ?? [],
      };
    }),
  );

  return NextResponse.json({ providers: enriched, servicesByProvider });
}
