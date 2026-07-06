import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  calcularBoteRepartoIncidencia,
  ejecutarRepartoIncidencia,
  enviarEmailsRepartoIncidencia,
} from "@/app/lib/incidencia-reparto";
import { roundMoney } from "@/app/lib/stripe-reembolso";
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
      return errorResponse("auth", "No autorizado", 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("body", "Body inválido", 400);
    }

    bookingId = body?.bookingId;
    const nota = typeof body?.nota === "string" ? body.nota : undefined;
    const importeCliente = roundMoney(body?.importeCliente);
    const importeProveedor = roundMoney(body?.importeProveedor);

    if (!bookingId) {
      return errorResponse("validate", "Falta bookingId", 400);
    }

    if (
      body?.importeCliente == null ||
      body?.importeProveedor == null ||
      Number.isNaN(importeCliente) ||
      Number.isNaN(importeProveedor)
    ) {
      return errorResponse(
        "validate",
        "Faltan importeCliente e importeProveedor numéricos",
        400,
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      return errorResponse("booking_select", bookingError.message, 500);
    }

    if (!booking) {
      return errorResponse("booking_select", "Reserva no encontrada", 404);
    }

    const botePreview = calcularBoteRepartoIncidencia(booking);

    const result = await ejecutarRepartoIncidencia(
      supabaseAdmin,
      booking,
      admin.id,
      importeCliente,
      importeProveedor,
      nota,
    );

    if (!result.success) {
      console.error("[reparto] failed", {
        bookingId,
        step: result.step,
        error: result.error,
      });
      return errorResponse(result.step || "unknown", result.error, result.status || 500, {
        stripe: result.stripe,
        bote: result.bote ?? botePreview,
        hint: result.hint,
        is_bundle: result.is_bundle,
      });
    }

    if (!result.already_processed) {
      try {
        await enviarEmailsRepartoIncidencia(
          booking,
          booking.services,
          result.importe_cliente,
          result.importe_proveedor,
          result.bote,
        );
      } catch (emailErr) {
        console.error("[reparto] email", emailErr?.message ?? emailErr);
      }
    }

    return NextResponse.json(result);
  } catch (unexpected) {
    console.error("[reparto] unhandled", {
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
