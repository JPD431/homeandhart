import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function mergeServiceEmbed(embed, fallback) {
  const raw = Array.isArray(embed) ? embed[0] : embed;
  if (!fallback) return raw ?? null;
  if (!raw) return fallback;
  return {
    titulo: raw.titulo || fallback.titulo,
    direccion_exacta: raw.direccion_exacta || fallback.direccion_exacta,
    telefono_contacto: raw.telefono_contacto || fallback.telefono_contacto,
    modalidad: raw.modalidad || fallback.modalidad,
    proveedor_id: raw.proveedor_id || fallback.proveedor_id,
  };
}

async function postBookingEmail(baseUrl, payload) {
  try {
    const res = await fetch(`${baseUrl}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error(
        "[bookings/respond] Error enviando email:",
        payload.tipo,
        errBody.error || res.status,
      );
    }
  } catch (err) {
    console.error("[bookings/respond] Error enviando email:", payload.tipo, err);
  }
}

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
    .select(
      "id, proveedor_id, titulo, direccion_exacta, telefono_contacto, modalidad",
    )
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
      const { data: bookingFull, error: bookingFullError } = await supabaseAdmin
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

      if (bookingFullError || !bookingFull) {
        console.error(
          "[bookings/respond] Error cargando booking para emails:",
          bookingFullError,
          { bookingId },
        );
      } else {
        const svc = mergeServiceEmbed(bookingFull.services, service);

        if (!bookingFull.cliente_id || !svc) {
          console.error(
            "[bookings/respond] Datos incompletos para emails de confirmación:",
            {
              bookingId,
              cliente_id: bookingFull.cliente_id,
              svc: !!svc,
            },
          );
        } else {
          const proveedorId = svc.proveedor_id;

          const [
            { data: proveedorProfile, error: proveedorProfileError },
            { data: clienteProfile, error: clienteProfileError },
          ] = await Promise.all([
            proveedorId
              ? supabaseAdmin
                  .from("profiles")
                  .select("nombre, apellido")
                  .eq("id", proveedorId)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            supabaseAdmin
              .from("profiles")
              .select("nombre, apellido, telefono")
              .eq("id", bookingFull.cliente_id)
              .maybeSingle(),
          ]);

          if (proveedorProfileError) {
            console.error(
              "[bookings/respond] Error cargando perfil proveedor:",
              proveedorProfileError,
              { bookingId, proveedorId },
            );
          }

          if (clienteProfileError) {
            console.error(
              "[bookings/respond] Error cargando perfil cliente:",
              clienteProfileError,
              { bookingId, cliente_id: bookingFull.cliente_id },
            );
          }

          const proveedorNombre =
            [proveedorProfile?.nombre, proveedorProfile?.apellido]
              .filter(Boolean)
              .join(" ") || "Proveedor";
          const clienteNombre =
            [clienteProfile?.nombre, clienteProfile?.apellido]
              .filter(Boolean)
              .join(" ") || undefined;
          const baseUrl =
            process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
          const finEmail =
            bookingFull.fecha_fin || bookingFull.fecha_inicio;
          const precioTotal = Number(bookingFull.precio_total || 0).toFixed(2);
          const mensaje = bookingFull.mensaje || "";

          await postBookingEmail(baseUrl, {
            tipo: "reserva_confirmada",
            solo_cliente: true,
            cliente_id: bookingFull.cliente_id,
            cliente_nombre: clienteNombre,
            proveedor_nombre: proveedorNombre,
            servicio_titulo: svc.titulo || "Servicio",
            fecha_inicio: bookingFull.fecha_inicio,
            fecha_fin: finEmail,
            precio_total: precioTotal,
            mensaje,
            direccion_exacta: svc.direccion_exacta,
            telefono_proveedor: svc.telefono_contacto,
            modalidad: svc.modalidad,
          });

          await postBookingEmail(baseUrl, {
            tipo: "reserva_confirmada_proveedor",
            proveedor_id: proveedorId,
            cliente_id: bookingFull.cliente_id,
            cliente_nombre: clienteNombre,
            cliente_telefono: clienteProfile?.telefono || undefined,
            servicio_titulo: svc.titulo || "Servicio",
            fecha_inicio: bookingFull.fecha_inicio,
            fecha_fin: finEmail,
            precio_total: precioTotal,
            mensaje,
          });
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
