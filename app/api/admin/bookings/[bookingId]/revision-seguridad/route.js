import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import {
  ejecutarReembolsoTotalIncidencia,
  enviarEmailReembolsoIncidencia,
} from "@/app/lib/incidencia-reembolso-total";
import { registrarCancelacion } from "@/app/lib/cancelaciones";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS_CANCELABLES_SEGURIDAD = new Set([
  "pendiente",
  "confirmada",
  "en_curso",
  "incidencia",
]);

/**
 * POST /api/admin/bookings/[bookingId]/revision-seguridad
 * Body: { accion: 'marcar_revisada' | 'cancelar', nota?: string }
 *
 * cancelar: reutiliza el flujo de reembolso total de incidencias
 * (pasa la reserva a incidencia si hace falta, luego reembolso 100% al cliente).
 */
export async function POST(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { bookingId } = await params;
  if (!bookingId) {
    return NextResponse.json({ error: "Falta bookingId" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const accion = typeof body?.accion === "string" ? body.accion.trim() : "";
  const nota =
    typeof body?.nota === "string" ? body.nota.trim() : "";

  if (accion !== "marcar_revisada" && accion !== "cancelar") {
    return NextResponse.json(
      { error: "accion debe ser 'marcar_revisada' o 'cancelar'" },
      { status: 400 },
    );
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      *,
      services:service_id (
        id,
        titulo,
        vertical,
        proveedor_id,
        cancellation_policy
      )
    `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (accion === "marcar_revisada") {
    const { error: clearError } = await supabaseAdmin
      .from("bookings")
      .update({ revision_seguridad_pendiente: false })
      .eq("id", bookingId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, accion: "marcar_revisada" });
  }

  // cancelar
  if (!ESTADOS_CANCELABLES_SEGURIDAD.has(booking.estado)) {
    const { error: clearError } = await supabaseAdmin
      .from("bookings")
      .update({ revision_seguridad_pendiente: false })
      .eq("id", bookingId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      accion: "cancelar",
      skipped_refund: true,
      message:
        "La reserva ya no está activa; solo se quitó el flag de revisión de seguridad.",
      estado: booking.estado,
    });
  }

  let working = booking;

  if (working.estado !== "incidencia") {
    const { data: asIncidencia, error: toIncError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "incidencia",
        comentario_problema:
          nota ||
          "Cancelación admin por revisión de seguridad / suspensión cautelar",
      })
      .eq("id", bookingId)
      .in("estado", ["pendiente", "confirmada", "en_curso"])
      .select("*")
      .maybeSingle();

    if (toIncError) {
      return NextResponse.json({ error: toIncError.message }, { status: 500 });
    }
    if (!asIncidencia) {
      return NextResponse.json(
        {
          error:
            "No se pudo pasar la reserva a incidencia (estado cambió). Reintenta.",
        },
        { status: 409 },
      );
    }
    working = { ...asIncidencia, services: booking.services };
  }

  const result = await ejecutarReembolsoTotalIncidencia(
    supabaseAdmin,
    working,
    admin.id,
    nota ||
      "Cancelación por revisión de seguridad (suspensión cautelar del proveedor)",
  );

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || "No se pudo cancelar/reembolsar",
        step: result.step,
        hint: result.hint,
      },
      { status: result.status || 500 },
    );
  }

  await supabaseAdmin
    .from("bookings")
    .update({ revision_seguridad_pendiente: false })
    .eq("id", bookingId);

  try {
    await registrarCancelacion({
      bookingId,
      usuarioId: admin.id,
      rolCancelador: "cliente",
      motivo:
        nota ||
        "Cancelación admin · revisión seguridad / suspensión cautelar",
    });
  } catch (err) {
    console.error("[revision-seguridad] registrarCancelacion:", err);
  }

  try {
    await enviarEmailReembolsoIncidencia(
      working,
      booking.services,
      result.reembolso,
    );
  } catch (err) {
    console.error("[revision-seguridad] email reembolso:", err);
  }

  return NextResponse.json({
    ok: true,
    accion: "cancelar",
    reembolso: result.reembolso,
    already_processed: result.already_processed === true,
  });
}
