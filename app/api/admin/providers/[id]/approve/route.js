import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import {
  REVISION_APROBADO,
  REVISION_EN_REVISION,
} from "@/app/lib/onboarding-persist";
import { serviceEligibleForAutoDisponible } from "@/app/lib/provider-publicacion";
import { resolveServicioPendienteNotifications } from "@/app/lib/service-revision-notify";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sendProveedorVerificadoEmail(userId, nombre) {
  if (isExcludedFromUserEmailSequences(userId)) {
    return;
  }

  try {
    const result = await sendPlatformEmail({
      tipo: "proveedor_verificado",
      user_id: userId,
      nombre,
    });
    if (!result.ok) {
      console.error(
        "[approve] Error enviando email proveedor_verificado:",
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error("[approve] Error enviando email proveedor_verificado:", err);
  }
}

export async function POST(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: proveedor, error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ verificado: true, rechazado: false })
    .eq("id", id)
    .select("nombre, cobros_activos, ninos_documentacion_aprobada")
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: servicesInReview, error: fetchInReviewError } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("proveedor_id", id)
    .eq("revision_estado", REVISION_EN_REVISION);

  if (fetchInReviewError) {
    console.error(
      "[approve] No se pudieron listar servicios en revisión:",
      fetchInReviewError,
    );
  }

  const { error: revisionError } = await supabaseAdmin
    .from("services")
    .update({ revision_estado: REVISION_APROBADO })
    .eq("proveedor_id", id)
    .eq("revision_estado", REVISION_EN_REVISION);

  if (revisionError) {
    console.error(
      "[approve] No se pudo marcar servicios como aprobados:",
      revisionError,
    );
  } else {
    for (const svc of servicesInReview ?? []) {
      try {
        await resolveServicioPendienteNotifications(svc.id);
      } catch (err) {
        console.error(
          "[approve] resolve notif servicio:",
          err?.message || err,
        );
      }
    }
  }

  let serviciosActivados = false;

  if (proveedor?.cobros_activos === true) {
    const { data: services, error: fetchError } = await supabaseAdmin
      .from("services")
      .select("id, revision_estado, vertical")
      .eq("proveedor_id", id);

    if (fetchError) {
      console.error("[approve] No se pudieron leer servicios:", fetchError);
    } else {
      const activables = (services ?? []).filter((s) =>
        serviceEligibleForAutoDisponible(s, proveedor),
      );
      const ids = activables.map((s) => s.id);

      if (ids.length > 0) {
        const { error: servicesError } = await supabaseAdmin
          .from("services")
          .update({ disponible: true })
          .in("id", ids);

        if (servicesError) {
          console.error(
            "[approve] No se pudieron activar los servicios del proveedor:",
            servicesError,
          );
        } else {
          serviciosActivados = true;
        }
      }
    }
  } else {
    const { error: servicesError } = await supabaseAdmin
      .from("services")
      .update({ disponible: false })
      .eq("proveedor_id", id);

    if (servicesError) {
      console.error(
        "[approve] No se pudieron pausar los servicios del proveedor:",
        servicesError,
      );
    }
  }

  if (proveedor) {
    await sendProveedorVerificadoEmail(id, proveedor.nombre);
  }

  return NextResponse.json({
    ok: true,
    servicios_activados: serviciosActivados,
    cobros_activos: proveedor?.cobros_activos === true,
  });
}
