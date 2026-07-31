import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { completarReservaYLiberarPago } from "@/app/lib/completar-reserva";
import {
  ejecutarReembolsoTotalIncidencia,
  enviarEmailReembolsoIncidencia,
} from "@/app/lib/incidencia-reembolso-total";
import { registrarCancelacion } from "@/app/lib/cancelaciones";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/admin/bookings/[bookingId]/forzar
 * Body: { accion: "completar" | "cancelar", nota?: string }
 *
 * completar → completarReservaYLiberarPago (F2, idempotente).
 * cancelar → reembolso total (misma vía que incidencias).
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
  const nota = typeof body?.nota === "string" ? body.nota.trim() : "";

  if (accion !== "completar" && accion !== "cancelar") {
    return NextResponse.json(
      { error: "accion debe ser 'completar' o 'cancelar'" },
      { status: 400 },
    );
  }

  if (accion === "completar") {
    const result = await completarReservaYLiberarPago(supabaseAdmin, bookingId, {
      source: "admin",
      liberarPago: true,
      notifyReview: true,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, capture: result.capture },
        { status: result.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      accion: "completar",
      completed: result.completed,
      already_completed: result.already_completed,
      already_paid: result.already_paid,
    });
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
        cancellation_policy,
        profiles:proveedor_id ( nombre, apellido )
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

  if (booking.pago_liberado_at) {
    return NextResponse.json(
      {
        error:
          "El pago ya se liberó al proveedor; no se puede cancelar con reembolso automático.",
      },
      { status: 409 },
    );
  }

  const cancelables = new Set([
    "pendiente",
    "confirmada",
    "en_curso",
    "incidencia",
    "completada",
  ]);

  if (!cancelables.has(booking.estado)) {
    return NextResponse.json(
      { error: `No se puede cancelar una reserva en estado «${booking.estado}».` },
      { status: 400 },
    );
  }

  let working = booking;

  if (working.estado !== "incidencia") {
    const { data: asIncidencia, error: toIncError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "incidencia",
        confirmacion_cliente: "problema",
        comentario_problema:
          nota || `Cancelación forzada por admin (${admin.id.slice(0, 8)})`,
        confirmado_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .in("estado", ["pendiente", "confirmada", "en_curso", "completada"])
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
    nota || "Cancelación forzada por admin",
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

  try {
    await registrarCancelacion({
      bookingId,
      usuarioId: admin.id,
      rolCancelador: "cliente",
      motivo: nota || "Cancelación forzada admin",
    });
  } catch (err) {
    console.error("[admin/forzar] registrarCancelacion:", err);
  }

  try {
    await enviarEmailReembolsoIncidencia(
      working,
      booking.services,
      result.reembolso,
    );
  } catch (err) {
    console.error("[admin/forzar] email reembolso:", err);
  }

  return NextResponse.json({
    success: true,
    accion: "cancelar",
    reembolso: result.reembolso,
    already_processed: result.already_processed === true,
  });
}
