import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  canLeaveReview,
  reviewEligibilityMessage,
} from "@/app/lib/reviews";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/reviews
 * Crea una reseña autenticada. Deriva cliente/proveedor/servicio de la reserva
 * (no acepta esos IDs del body). Valida completada + ventana + no duplicado + no auto-reseña.
 *
 * Body: { booking_id, valoracion, comentario? }
 */
export async function POST(request) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const bookingId =
    typeof body?.booking_id === "string" ? body.booking_id.trim() : "";
  const valoracionRaw = body?.valoracion;
  const valoracion = Number(valoracionRaw);
  const comentario =
    typeof body?.comentario === "string" ? body.comentario.trim() : "";

  if (!bookingId) {
    return NextResponse.json({ error: "Falta booking_id" }, { status: 400 });
  }
  if (
    !Number.isInteger(valoracion) ||
    valoracion < 1 ||
    valoracion > 5
  ) {
    return NextResponse.json(
      { error: "La valoración debe ser un entero entre 1 y 5." },
      { status: 400 },
    );
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, cliente_id, service_id, estado, completada_at, fecha_fin, fecha_inicio",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json(
      {
        error: reviewEligibilityMessage("not_found"),
        code: "not_found",
      },
      { status: 404 },
    );
  }

  if (!booking.service_id) {
    return NextResponse.json(
      { error: "La reserva no tiene servicio asociado", code: "no_service" },
      { status: 400 },
    );
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }
  if (!service?.proveedor_id) {
    return NextResponse.json(
      { error: "Servicio no encontrado", code: "no_service" },
      { status: 404 },
    );
  }

  if (booking.cliente_id === service.proveedor_id) {
    return NextResponse.json(
      {
        error: "No puedes valorar tu propio servicio.",
        code: "self_review",
      },
      { status: 403 },
    );
  }

  const { data: existingReview, error: existingError } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const eligibility = canLeaveReview(booking, {
    hasReview: Boolean(existingReview),
    userId: user.id,
  });

  if (!eligibility.ok) {
    const status =
      eligibility.reason === "forbidden"
        ? 403
        : eligibility.reason === "already_reviewed"
          ? 409
          : 400;
    return NextResponse.json(
      {
        error: reviewEligibilityMessage(eligibility.reason),
        code: eligibility.reason,
      },
      { status },
    );
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("reviews")
    .insert({
      booking_id: booking.id,
      cliente_id: booking.cliente_id,
      proveedor_id: service.proveedor_id,
      service_id: service.id,
      valoracion,
      comentario: comentario || null,
    })
    .select("id, booking_id, valoracion, comentario, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          error: reviewEligibilityMessage("already_reviewed"),
          code: "already_reviewed",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    review: inserted,
  });
}
