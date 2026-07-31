import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { completarReservaYLiberarPago } from "@/app/lib/completar-reserva";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/bookings/completar-cliente
 * Body: { bookingId, token? }
 *
 * Auth: sesión del cliente de la reserva, o token HMAC del email.
 * Completa (confirmada|en_curso → completada) y libera pago (F2, idempotente).
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const bookingId =
    typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!bookingId) {
    return NextResponse.json({ error: "Falta bookingId" }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, cliente_id, payment_intent_id, estado")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  let source = "cliente";
  let authorized = false;

  if (token) {
    const ok = verificarTokenConfirmacion(
      bookingId,
      booking.payment_intent_id || "",
      token,
    );
    if (ok) {
      authorized = true;
      source = "email";
    }
  }

  if (!authorized) {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.id !== booking.cliente_id) {
      return NextResponse.json(
        { error: "No puedes confirmar esta reserva." },
        { status: 403 },
      );
    }
    authorized = true;
    source = "cliente";
  }

  const result = await completarReservaYLiberarPago(supabaseAdmin, bookingId, {
    source,
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
    completed: result.completed,
    already_completed: result.already_completed,
    already_paid: result.already_paid,
  });
}
