import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  getFirstActivationBlocker,
  servicioRevisionAprobada,
} from "@/app/lib/provider-publicacion";
import { loadServiceContactAdmin } from "@/app/lib/service-contact";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * PATCH /api/services/[serviceId]/disponible
 * Body: { disponible: boolean }
 * Solo el dueño (proveedor_id === user.id). Off libre; on con gates + servicio aprobado.
 */
export async function PATCH(request, { params }) {
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
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body?.disponible !== "boolean") {
    return NextResponse.json(
      { error: "Falta disponible (boolean)" },
      { status: 400 },
    );
  }

  const wantDisponible = body.disponible;

  const { data: owned, error: ownerError } = await supabase
    .from("services")
    .select(
      "id, proveedor_id, vertical, revision_estado, nru, modalidad, disponible",
    )
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }
  if (!owned) {
    return NextResponse.json(
      { error: "Servicio no encontrado o sin permiso" },
      { status: 404 },
    );
  }

  if (!servicioRevisionAprobada(owned.revision_estado)) {
    return NextResponse.json(
      {
        error:
          "Solo puedes pausar o activar un servicio ya aprobado. Mientras esté en borrador, revisión o rechazado, no aplica el switch.",
        code: "revision_not_approved",
        revision_estado: owned.revision_estado,
        disponible: owned.disponible !== false,
      },
      { status: 409 },
    );
  }

  if (wantDisponible === true) {
    const { data: perfil, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, verificado, cobros_activos, mayor_de_edad_confirmada, ninos_documentacion_aprobada, doc_dni_url, doc_antecedentes_url, doc_antecedentes_sexuales_url, dni_estado, telefono, email_contacto",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !perfil) {
      return NextResponse.json(
        { error: profileError?.message || "Perfil no encontrado" },
        { status: 500 },
      );
    }

    const { data: docsRows } = await supabaseAdmin
      .from("provider_documents")
      .select("id, proveedor_id, tipo, vertical, url, created_at, updated_at")
      .eq("proveedor_id", user.id);

    const contact = await loadServiceContactAdmin(serviceId, supabaseAdmin);

    const documentContext = {
      accountEmail: user.email || null,
      profile: {
        doc_dni_url: perfil.doc_dni_url,
        doc_antecedentes_url: perfil.doc_antecedentes_url,
        doc_antecedentes_sexuales_url: perfil.doc_antecedentes_sexuales_url,
      },
      providerDocuments: docsRows ?? [],
      services: [
        {
          vertical: owned.vertical,
          nru: owned.nru,
          details: { nru: owned.nru },
        },
      ],
    };

    const serviceForGate = {
      vertical: owned.vertical,
      modalidad: owned.modalidad,
      details: {
        nru: owned.nru,
        modalidad: owned.modalidad,
        direccion_exacta: contact?.direccion_exacta ?? null,
      },
      direccion_exacta: contact?.direccion_exacta ?? null,
    };

    const bloqueo = getFirstActivationBlocker(
      perfil,
      serviceForGate,
      documentContext,
    );
    if (bloqueo) {
      return NextResponse.json(
        {
          error: bloqueo.message,
          code: bloqueo.code,
          disponible: false,
        },
        { status: 403 },
      );
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("services")
    .update({ disponible: wantDisponible })
    .eq("id", serviceId)
    .eq("proveedor_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: verified, error: verifyError } = await supabaseAdmin
    .from("services")
    .select("id, disponible, revision_estado")
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .maybeSingle();

  if (verifyError || !verified) {
    return NextResponse.json(
      { error: verifyError?.message || "No se pudo verificar el guardado" },
      { status: 500 },
    );
  }

  if (verified.disponible !== wantDisponible) {
    return NextResponse.json(
      {
        error: "La base de datos no confirmó el nuevo estado de disponibilidad",
        disponible: verified.disponible,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: verified.id,
    disponible: verified.disponible,
    revision_estado: verified.revision_estado,
  });
}
