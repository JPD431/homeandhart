import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { bookingId, action } = body ?? {};

  if (!bookingId || !action || !["aceptar", "rechazar"].includes(action)) {
    return NextResponse.json(
      { error: "Faltan bookingId o action, o action no es válido" },
      { status: 400 },
    );
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
      "id, service_id, payment_intent_id, estado, cliente_id, fecha_inicio, fecha_fin, precio_total, mensaje",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, proveedor_id")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  if (!service || service.proveedor_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (booking.estado !== "pendiente") {
    return NextResponse.json(
      { error: "La reserva ya no está pendiente" },
      { status: 409 },
    );
  }

  if (action === "rechazar" && booking.payment_intent_id) {
    try {
      await stripe.paymentIntents.cancel(booking.payment_intent_id);
    } catch (err) {
      console.error(
        "Error cancelando PaymentIntent al rechazar reserva:",
        booking.payment_intent_id,
        err?.message ?? err,
      );
    }
  }

  const nuevoEstado = action === "aceptar" ? "confirmada" : "rechazada";

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ estado: nuevoEstado })
    .eq("id", bookingId)
    .eq("estado", "pendiente");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (action === "rechazar") {
    try {
      const { error: disponibilidadError } = await supabaseAdmin
        .from("disponibilidad")
        .delete()
        .eq("booking_id", bookingId);
      if (disponibilidadError) {
        console.error(
          "[bookings/respond] No se pudo liberar disponibilidad al rechazar:",
          disponibilidadError,
          { bookingId },
        );
      }
    } catch (dispErr) {
      console.error(
        "[bookings/respond] No se pudo liberar disponibilidad al rechazar:",
        dispErr,
        { bookingId },
      );
    }
  }

  if (action === "aceptar") {
    try {
      const { data: bookingFull } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          id,
          cliente_id,
          fecha_inicio,
          fecha_fin,
          precio_total,
          mensaje,
          services:service_id (
            titulo,
            direccion_exacta,
            telefono_contacto,
            modalidad,
            proveedor_id
          )
        `,
        )
        .eq("id", bookingId)
        .single();

      const svc = bookingFull?.services;
      const proveedorId = svc?.proveedor_id;

      const { data: proveedorProfile } = proveedorId
        ? await supabaseAdmin
            .from("profiles")
            .select("nombre, apellido")
            .eq("id", proveedorId)
            .maybeSingle()
        : { data: null };

      if (bookingFull?.cliente_id && svc) {
        const proveedorNombre =
          [proveedorProfile?.nombre, proveedorProfile?.apellido]
            .filter(Boolean)
            .join(" ") || "Proveedor";
        const baseUrl =
          process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

        const emailRes = await fetch(`${baseUrl}/api/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "reserva_confirmada",
            solo_cliente: true,
            cliente_id: bookingFull.cliente_id,
            proveedor_nombre: proveedorNombre,
            servicio_titulo: svc.titulo || "Servicio",
            fecha_inicio: bookingFull.fecha_inicio,
            fecha_fin: bookingFull.fecha_fin || bookingFull.fecha_inicio,
            precio_total: Number(bookingFull.precio_total || 0).toFixed(2),
            mensaje: bookingFull.mensaje || "",
            direccion_exacta: svc.direccion_exacta,
            telefono_proveedor: svc.telefono_contacto,
            modalidad: svc.modalidad,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.json().catch(() => ({}));
          console.error(
            "[bookings/respond] Error enviando email de confirmación:",
            errBody.error || emailRes.status,
          );
        }
      }
    } catch (emailErr) {
      console.error(
        "[bookings/respond] Error enviando email de confirmación:",
        emailErr,
      );
    }
  }

  return NextResponse.json({ success: true, estado: nuevoEstado });
}
