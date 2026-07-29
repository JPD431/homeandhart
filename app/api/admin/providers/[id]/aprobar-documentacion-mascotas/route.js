import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import { getMascotasDocumentacionStatus } from "@/app/lib/provider-documents";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sendMascotasDocsAprobadaEmail(userId, nombre) {
  if (isExcludedFromUserEmailSequences(userId)) {
    return;
  }

  try {
    const result = await sendPlatformEmail({
      tipo: "mascotas_documentacion_aprobada",
      user_id: userId,
      nombre,
    });
    if (!result.ok) {
      console.error(
        "[aprobar-documentacion-mascotas] email:",
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[aprobar-documentacion-mascotas] email:", err);
  }
}

/**
 * Admin aprueba la documentación de mascotas (DNI + antecedentes penales).
 * Independiente de verificado y de ninos_documentacion_aprobada.
 */
export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, nombre, role, doc_dni_url, doc_antecedentes_url, mascotas_documentacion_aprobada",
    )
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || profile.role !== "proveedor") {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const { data: mascotasServices, error: servicesError } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("proveedor_id", id)
    .eq("vertical", "mascotas")
    .limit(1);

  if (servicesError) {
    return NextResponse.json({ error: servicesError.message }, { status: 500 });
  }

  if (!mascotasServices?.length) {
    return NextResponse.json(
      { error: "Este proveedor no tiene servicios de mascotas" },
      { status: 400 },
    );
  }

  const status = getMascotasDocumentacionStatus(profile);
  if (!status.allUploaded) {
    return NextResponse.json(
      {
        error: "Faltan documentos de mascotas",
        code: "mascotas_documentos_faltantes",
        faltantes: status.missingLabels,
      },
      { status: 400 },
    );
  }

  if (profile.mascotas_documentacion_aprobada === true) {
    return NextResponse.json({
      ok: true,
      already_approved: true,
      mascotas_documentacion_aprobada: true,
    });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      mascotas_documentacion_aprobada: true,
      mascotas_documentacion_aprobada_at: new Date().toISOString(),
      mascotas_documentacion_aprobada_por: admin.id,
    })
    .eq("id", id)
    .select(
      "id, mascotas_documentacion_aprobada, mascotas_documentacion_aprobada_at, mascotas_documentacion_aprobada_por",
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await sendMascotasDocsAprobadaEmail(id, profile.nombre);

  return NextResponse.json({
    ok: true,
    mascotas_documentacion_aprobada: true,
    mascotas_documentacion_aprobada_at: updated?.mascotas_documentacion_aprobada_at,
    mascotas_documentacion_aprobada_por: updated?.mascotas_documentacion_aprobada_por,
  });
}
