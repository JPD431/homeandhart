import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCancelacionTardia } from "@/app/lib/is-cancelacion-tardia";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ESTADOS_CANCELABLES = new Set(["pendiente", "confirmada"]);

async function resolveClienteContact(clienteId) {
  const { data: authData } =
    await supabaseAdmin.auth.admin.getUserById(clienteId);

  let clienteEmail = authData?.user?.email ?? null;

  const { data: clienteProfile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido, email_contacto")
    .eq("id", clienteId)
    .maybeSingle();

  if (!clienteEmail && clienteProfile?.email_contacto) {
    clienteEmail = clienteProfile.email_contacto;
  }

  const clienteNombre =
    [clienteProfile?.nombre, clienteProfile?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim() || "Cliente";

  return { clienteEmail, clienteNombre };
}

async function buscarAlternativasGarantia(booking, service) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  try {
    const garantiaRes = await fetch(`${baseUrl}/api/garantia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: booking.service_id,
        fecha_inicio: booking.fecha_inicio,
        fecha_fin: booking.fecha_fin || booking.fecha_inicio,
        vertical: service?.vertical,
        ciudad: service?.ciudad,
      }),
    });

    const garantiaData = await garantiaRes.json().catch(() => ({}));
    if (!garantiaRes.ok) {
      console.error(
        "[bookings/cancelar-cliente] Error al buscar alternativas:",
        garantiaData.error || garantiaRes.status,
        { bookingId: booking.id },
      );
      return [];
    }

    return garantiaData.alternativas ?? [];
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] Error al buscar alternativas:",
      err,
      { bookingId: booking.id },
    );
    return [];
  }
}

async function enviarEmailCancelacionGarantia(
  booking,
  alternativas,
  clienteEmail,
  clienteNombre,
) {
  if (alternativas.length === 0 || !clienteEmail) return;

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  try {
    const emailRes = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "cancelacion_garantia",
        cliente_email: clienteEmail,
        cliente_nombre: clienteNombre,
        precio_original: booking.precio_total,
        alternativas,
      }),
    });

    if (!emailRes.ok) {
      const emailData = await emailRes.json().catch(() => ({}));
      console.error(
        "[bookings/cancelar-cliente] Error al enviar email de garantía:",
        emailData.error || emailRes.status,
        { bookingId: booking.id },
      );
    }
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] Error al enviar email de garantía:",
      err,
      { bookingId: booking.id },
    );
  }
}

async function liberarFechasReserva(bookingId) {
  try {
    const { error } = await supabaseAdmin
      .from("disponibilidad")
      .delete()
      .eq("booking_id", bookingId);

    if (error) {
      console.error(
        "[bookings/cancelar-cliente] No se pudo liberar disponibilidad:",
        error,
        { bookingId },
      );
    }
  } catch (err) {
    console.error(
      "[bookings/cancelar-cliente] No se pudo liberar disponibilidad:",
      err,
      { bookingId },
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const bookingId = body?.booking_id;

  if (!bookingId) {
    return NextResponse.json({ error: "Falta booking_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      cliente_id,
      service_id,
      estado,
      payment_intent_id,
      fecha_inicio,
      fecha_fin,
      precio_total,
      grupo_reserva,
      services:service_id (
        titulo,
        vertical,
        ciudad,
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

  if (booking.cliente_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!ESTADOS_CANCELABLES.has(booking.estado)) {
    return NextResponse.json(
      { error: "Esta reserva no se puede cancelar" },
      { status: 409 },
    );
  }

  const tardia = isCancelacionTardia(booking.fecha_inicio);
  const service = booking.services;
  const canceladoAt = new Date().toISOString();
  let alternativas = [];
  let estadoFinal;

  if (!tardia) {
    // TODO Fase 2: reembolso Stripe según getRefundPercent (payment_intent_id)
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "cancelada",
        cancelado_at: canceladoAt,
      })
      .eq("id", bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    estadoFinal = "cancelada";
  } else {
    alternativas = await buscarAlternativasGarantia(booking, service);

    // TODO Fase 2: reembolso Stripe según getRefundPercent (payment_intent_id)
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        estado: "cancelada_garantia",
        estado_garantia: "activada",
        cancelado_at: canceladoAt,
      })
      .eq("id", bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    estadoFinal = "cancelada_garantia";

    const { clienteEmail, clienteNombre } = await resolveClienteContact(
      booking.cliente_id,
    );
    await enviarEmailCancelacionGarantia(
      booking,
      alternativas,
      clienteEmail,
      clienteNombre,
    );
  }

  await liberarFechasReserva(bookingId);

  return NextResponse.json({
    ok: true,
    estado: estadoFinal,
    garantia: tardia,
    alternativas,
  });
}
