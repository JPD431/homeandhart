import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  ejecutarReembolsoTotalIncidencia,
  enviarEmailReembolsoIncidencia,
} from "@/app/lib/incidencia-reembolso-total";
import { getAdminUser } from "@/lib/auth/requireAdmin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BOOKING_SELECT = `
  id,
  cliente_id,
  service_id,
  estado,
  payment_intent_id,
  precio_total,
  credito_aplicado,
  resolucion_tipo,
  resolucion_at,
  services:service_id (
    titulo,
    profiles_public:proveedor_id (nombre, apellido)
  )
`;

function errorResponse(step, message, status, extra = {}) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      step,
      ...extra,
    },
    { status },
  );
}

export async function POST(request) {
  let bookingId;

  try {
    const admin = await getAdminUser();
    if (!admin) {
      console.error("[reembolso] auth", { ok: false, reason: "no_admin_session" });
      return errorResponse("auth", "No autorizado", 403);
    }

    console.error("[reembolso] auth", { ok: true, adminId: admin.id });

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[reembolso] body", {
        ok: false,
        message: parseErr?.message ?? String(parseErr),
      });
      return errorResponse("body", "Body inválido", 400);
    }

    bookingId = body?.bookingId;
    const nota = typeof body?.nota === "string" ? body.nota : undefined;

    if (!bookingId) {
      console.error("[reembolso] validate", { ok: false, reason: "missing_bookingId" });
      return errorResponse("validate", "Falta bookingId", 400);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error("[reembolso] booking", {
        ok: false,
        bookingId,
        message: bookingError.message,
        code: bookingError.code,
        details: bookingError.details,
        hint: bookingError.hint,
      });
      return errorResponse("booking_select", bookingError.message, 500, {
        db_code: bookingError.code,
        db_hint: bookingError.hint,
        hint: bookingError.message.includes("resolucion_")
          ? "¿Ejecutaste la migración de columnas resolucion_* en bookings?"
          : undefined,
      });
    }

    if (!booking) {
      console.error("[reembolso] booking", { ok: false, bookingId, reason: "not_found" });
      return errorResponse("booking_select", "Reserva no encontrada", 404);
    }

    console.error("[reembolso] booking", {
      ok: true,
      bookingId: booking.id,
      estado: booking.estado,
      payment_intent_id: booking.payment_intent_id,
      precio_total: booking.precio_total,
      credito_aplicado: booking.credito_aplicado,
    });

    const result = await ejecutarReembolsoTotalIncidencia(
      supabaseAdmin,
      booking,
      admin.id,
      nota,
    );

    if (!result.success) {
      console.error("[reembolso] failed", {
        bookingId,
        step: result.step,
        error: result.error,
        stripe: result.stripe,
        db_code: result.db_code,
      });
      return errorResponse(result.step || "unknown", result.error, result.status || 500, {
        stripe: result.stripe,
        reembolso: result.reembolso,
        hint: result.hint,
        stripe_type: result.stripe_type,
        stripe_code: result.stripe_code,
        db_code: result.db_code,
        db_hint: result.db_hint,
      });
    }

    if (!result.already_processed) {
      try {
        await enviarEmailReembolsoIncidencia(
          booking,
          booking.services,
          result.reembolso,
        );
      } catch (emailErr) {
        console.error("[reembolso] email", {
          ok: false,
          bookingId,
          message: emailErr?.message ?? String(emailErr),
        });
      }
    }

    console.error("[reembolso] success", {
      ok: true,
      bookingId,
      already_processed: Boolean(result.already_processed),
      stripe_action: result.stripe?.stripe_action,
    });

    return NextResponse.json(result);
  } catch (unexpected) {
    console.error("[reembolso] unhandled", {
      bookingId,
      message: unexpected?.message ?? String(unexpected),
      stack: unexpected?.stack,
    });
    return errorResponse(
      "unhandled",
      unexpected?.message ?? "Error interno inesperado",
      500,
    );
  }
}
