import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyBookingEvent } from "@/app/lib/notifications";
import { attachContactToServiceAdmin } from "@/app/lib/service-contact";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function getReservasSinComisionProveedor(perfil) {
  return Number(perfil?.reservas_sin_comision_proveedor) || 0;
}

function buildProveedorIngresoEmailFields(booking, proveedorProfile) {
  const precioTotal = Number(booking.precio_total || 0);

  return {
    precio_base: booking.precio_base,
    precio_total: precioTotal.toFixed(2),
    cliente_sin_comision: booking.cliente_sin_comision === true,
    proveedor_sin_comision: booking.proveedor_sin_comision === true,
    sinComisionProveedor: getReservasSinComisionProveedor(proveedorProfile) > 0,
  };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function contarBookingsPorPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return 1;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("payment_intent_id", paymentIntentId);

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

/** Salvaguarda legacy: 1 PI por booking en reservas nuevas; si count > 1, solo avisar. */
function warnLegacySharedPaymentIntentRespond(
  bookingId,
  paymentIntentId,
  bookingsEnGrupo,
) {
  if (bookingsEnGrupo <= 1) return;

  console.warn(
    "[bookings/respond] PI compartido detectado en respond — el cancel/refund afectará a varios bookings",
    {
      bookingId,
      payment_intent_id: paymentIntentId,
      bookingsEnGrupo,
    },
  );
}

function mergeServiceEmbed(embed, fallback) {
  const raw = Array.isArray(embed) ? embed[0] : embed;
  if (!fallback) return raw ?? null;
  if (!raw) return fallback;
  return {
    titulo: raw.titulo || fallback.titulo,
    // Preferir contacto ya resuelto (service_contact) del fallback
    direccion_exacta: fallback.direccion_exacta || raw.direccion_exacta,
    telefono_contacto: fallback.telefono_contacto || raw.telefono_contacto,
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

  const { data: serviceRaw, error: serviceError } = await supabaseAdmin
    .from("services")
    .select(
      "id, proveedor_id, titulo, direccion_exacta, telefono_contacto, modalidad",
    )
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  const service = serviceRaw
    ? await attachContactToServiceAdmin(serviceRaw)
    : null;

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
      try {
        const bookingsEnGrupo = await contarBookingsPorPaymentIntent(
          booking.payment_intent_id,
        );
        warnLegacySharedPaymentIntentRespond(
          booking.id,
          booking.payment_intent_id,
          bookingsEnGrupo,
        );
      } catch (countErr) {
        console.error(
          "[bookings/respond] Error contando bookings del PI:",
          countErr,
          { bookingId: booking.id },
        );
      }

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

    try {
      const [
        { data: proveedorProfile, error: proveedorProfileError },
        { data: clienteProfile, error: clienteProfileError },
      ] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("nombre, apellido")
          .eq("id", user.id)
          .maybeSingle(),
        booking.cliente_id
          ? supabaseAdmin
              .from("profiles")
              .select("nombre, apellido")
              .eq("id", booking.cliente_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (proveedorProfileError) {
        console.error(
          "[bookings/respond] Error cargando perfil proveedor (rechazo):",
          proveedorProfileError,
          { bookingId },
        );
      }

      if (clienteProfileError) {
        console.error(
          "[bookings/respond] Error cargando perfil cliente (rechazo):",
          clienteProfileError,
          { bookingId, cliente_id: booking.cliente_id },
        );
      }

      if (booking.cliente_id) {
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
        const finEmail = booking.fecha_fin || booking.fecha_inicio;

        await postBookingEmail(baseUrl, {
          tipo: "reserva_rechazada",
          cliente_id: booking.cliente_id,
          cliente_nombre: clienteNombre,
          proveedor_nombre: proveedorNombre,
          servicio_titulo: service.titulo || "Servicio",
          fecha_inicio: booking.fecha_inicio,
          fecha_fin: finEmail,
          precio_total: Number(booking.precio_total || 0).toFixed(2),
        });

        console.log("[bookings/respond] Creando notificación reserva_rechazada", {
          bookingId,
          clienteId: booking.cliente_id,
        });

        const rejectNotif = await notifyBookingEvent(supabaseAdmin, {
          tipo: "reserva_rechazada",
          bookingId,
          clienteId: booking.cliente_id,
          proveedorNombre,
          servicioTitulo: service.titulo,
          fechaInicio: booking.fecha_inicio,
          fechaFin: finEmail,
        });

        if (!rejectNotif?.ok) {
          console.error(
            "[bookings/respond] Notificación reserva_rechazada NO creada:",
            rejectNotif,
          );
        }
      }
    } catch (emailErr) {
      console.error(
        "[bookings/respond] Error enviando email de rechazo:",
        emailErr,
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
          credito_aplicado,
          precio_base,
          cliente_sin_comision,
          proveedor_sin_comision,
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
                  .select(
                    "nombre, apellido, telefono, reservas_sin_comision_proveedor",
                  )
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
          const creditoAplicado = Number(bookingFull.credito_aplicado) || 0;
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
            credito_aplicado: creditoAplicado,
            mensaje,
            direccion_exacta: svc.direccion_exacta,
            telefono_proveedor:
              svc.telefono_contacto || proveedorProfile?.telefono || undefined,
            modalidad: svc.modalidad,
          });

          console.log(
            "[bookings/respond] Creando notificación reserva_confirmada",
            {
              bookingId,
              clienteId: bookingFull.cliente_id,
            },
          );

          const confirmNotif = await notifyBookingEvent(supabaseAdmin, {
            tipo: "reserva_confirmada",
            bookingId,
            clienteId: bookingFull.cliente_id,
            proveedorNombre,
            servicioTitulo: svc.titulo,
            fechaInicio: bookingFull.fecha_inicio,
            fechaFin: finEmail,
          });

          if (!confirmNotif?.ok) {
            console.error(
              "[bookings/respond] Notificación reserva_confirmada NO creada:",
              confirmNotif,
            );
          }

          await postBookingEmail(baseUrl, {
            tipo: "reserva_confirmada_proveedor",
            proveedor_id: proveedorId,
            cliente_id: bookingFull.cliente_id,
            cliente_nombre: clienteNombre,
            cliente_telefono: clienteProfile?.telefono || undefined,
            servicio_titulo: svc.titulo || "Servicio",
            fecha_inicio: bookingFull.fecha_inicio,
            fecha_fin: finEmail,
            mensaje,
            ...buildProveedorIngresoEmailFields(bookingFull, proveedorProfile),
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
