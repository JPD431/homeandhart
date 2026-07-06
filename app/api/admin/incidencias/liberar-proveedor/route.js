import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  ejecutarLiberarProveedorIncidencia,
  enviarEmailsLiberarProveedorIncidencia,
} from "@/app/lib/incidencia-liberar-proveedor";
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
  precio_base,
  credito_aplicado,
  cliente_sin_comision,
  proveedor_sin_comision,
  pago_liberado_at,
  importe_transferido,
  resolucion_tipo,
  resolucion_at,
  services:service_id (
    titulo,
    proveedor_id,
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
      console.error("[liberar-proveedor] auth", { ok: false });
      return errorResponse("auth", "No autorizado", 403);
    }

    console.error("[liberar-proveedor] auth", { ok: true, adminId: admin.id });

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      return errorResponse("body", "Body inválido", 400);
    }

    bookingId = body?.bookingId;
    const nota = typeof body?.nota === "string" ? body.nota : undefined;

    if (!bookingId) {
      return errorResponse("validate", "Falta bookingId", 400);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error("[liberar-proveedor] booking", {
        ok: false,
        bookingId,
        message: bookingError.message,
      });
      return errorResponse("booking_select", bookingError.message, 500);
    }

    if (!booking) {
      return errorResponse("booking_select", "Reserva no encontrada", 404);
    }

    console.error("[liberar-proveedor] booking", {
      ok: true,
      bookingId: booking.id,
      estado: booking.estado,
      payment_intent_id: booking.payment_intent_id,
      pago_liberado_at: booking.pago_liberado_at,
    });

    const result = await ejecutarLiberarProveedorIncidencia(
      supabaseAdmin,
      booking,
      admin.id,
      nota,
    );

    if (!result.success) {
      console.error("[liberar-proveedor] failed", {
        bookingId,
        step: result.step,
        error: result.error,
      });
      return errorResponse(result.step || "unknown", result.error, result.status || 500, {
        stripe: result.stripe,
        hint: result.hint,
        importe_proveedor: result.importe_proveedor,
      });
    }

    if (!result.already_processed) {
      try {
        await enviarEmailsLiberarProveedorIncidencia(
          booking,
          booking.services,
          result.importe_proveedor,
        );
      } catch (emailErr) {
        console.error("[liberar-proveedor] email", {
          ok: false,
          message: emailErr?.message ?? String(emailErr),
        });
      }
    }

    console.error("[liberar-proveedor] success", {
      ok: true,
      bookingId,
      importe_proveedor: result.importe_proveedor,
      stripe_action: result.stripe?.stripe_action,
    });

    return NextResponse.json(result);
  } catch (unexpected) {
    console.error("[liberar-proveedor] unhandled", {
      bookingId,
      message: unexpected?.message ?? String(unexpected),
    });
    return errorResponse(
      "unhandled",
      unexpected?.message ?? "Error interno inesperado",
      500,
    );
  }
}
