import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyBookingEvent } from "@/app/lib/notifications";
import {
  attachContactToServiceAdmin,
  buildProviderContactEmailFields,
} from "@/app/lib/service-contact";
import { loadBookingContactClienteAdmin } from "@/app/lib/booking-contact-cliente";
import { shouldShowClienteDireccionToProvider } from "@/app/lib/lugar-servicio";
import { sendPlatformEmail } from "@/app/lib/send-platform-email";
import {
  aplicarReembolsoStripeBooking,
  calcularReembolsoTotal,
} from "@/app/lib/stripe-reembolso";

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

/**
 * Libera el hold de ESTA línea al rechazar (F6 + M9).
 * Idempotente por bookingId. Si el PI es compartido con otras reservas activas,
 * hace capture parcial (no cancela el PI entero).
 */
async function cancelPaymentIntentOnReject(booking) {
  const paymentIntentId = booking?.payment_intent_id;
  if (!paymentIntentId) {
    return { ok: true, action: "sin_pi" };
  }

  const { tarjeta } = calcularReembolsoTotal(booking);
  // Solo crédito / sin tarjeta: no tocar el PI (puede estar compartido).
  if (tarjeta <= 0) {
    return { ok: true, action: "sin_cargo_tarjeta" };
  }

  const result = await aplicarReembolsoStripeBooking(
    stripe,
    paymentIntentId,
    tarjeta,
    {
      idempotencyKey: `cancel-pi:respond-reject:${booking.id}`,
      supabaseAdmin,
      bookingId: booking.id,
    },
  );

  if (result.stripe_ok === false) {
    return {
      ok: false,
      action: result.stripe_action,
      pi_status: result.pi_status,
      error: result.stripe_error,
    };
  }

  return {
    ok: true,
    action: result.stripe_action,
    pi_status: result.pi_status,
  };
}

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
    // Contacto solo desde service_contact (ya resuelto en fallback)
    direccion_exacta: fallback.direccion_exacta ?? null,
    telefono_contacto: fallback.telefono_contacto ?? null,
    modalidad: raw.modalidad || fallback.modalidad,
    vertical: raw.vertical || fallback.vertical,
    proveedor_id: raw.proveedor_id || fallback.proveedor_id,
    id: raw.id || fallback.id,
  };
}

async function postBookingEmail(_baseUrl, payload) {
  try {
    const result = await sendPlatformEmail(payload);
    if (!result.ok) {
      console.error(
        "[bookings/respond] FALLO email (flujo NO abortado)",
        `tipo=${payload?.tipo || "?"}`,
        `status=${result.status ?? "?"}`,
        result.error || result.status,
      );
    }
  } catch (err) {
    console.error(
      "[bookings/respond] EXCEPCIÓN email (flujo NO abortado)",
      payload?.tipo,
      err,
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
      "id, service_id, payment_intent_id, estado, cliente_id, fecha_inicio, fecha_fin, precio_total, credito_aplicado, mensaje",
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
    .select("id, proveedor_id, titulo, modalidad, vertical")
    .eq("id", booking.service_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  const service = serviceRaw
    ? await attachContactToServiceAdmin(serviceRaw, supabaseAdmin)
    : null;

  if (!service || service.proveedor_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const nuevoEstado = action === "aceptar" ? "confirmada" : "rechazada";

  // F6: claim atómico ANTES de tocar Stripe. Solo uno de accept/reject gana.
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({ estado: nuevoEstado })
    .eq("id", bookingId)
    .eq("estado", "pendiente")
    .select("id, estado");

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  const wonClaim = Array.isArray(claimedRows) && claimedRows.length > 0;

  if (!wonClaim) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("bookings")
      .select("id, estado, payment_intent_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { error: currentError.message },
        { status: 500 },
      );
    }

    // Idempotencia: mismo action ya aplicado.
    if (current?.estado === nuevoEstado) {
      // Reject reintento: asegurar cancel del PI (idempotente) por si falló tras el claim.
      if (action === "rechazar" && current.payment_intent_id) {
        try {
          await cancelPaymentIntentOnReject(
            current.payment_intent_id,
            bookingId,
          );
        } catch (err) {
          console.error(
            "[bookings/respond] Error reintentando cancel PI (already_processed):",
            current.payment_intent_id,
            err?.message ?? err,
          );
        }
      }

      return NextResponse.json({
        success: true,
        already_processed: true,
        estado: nuevoEstado,
      });
    }

    // Accept vs reject concurrente / estado incompatible: no tocar el PI.
    return NextResponse.json(
      {
        error: "La reserva ya no está pendiente",
        estado: current?.estado ?? null,
      },
      { status: 409 },
    );
  }

  // Solo el ganador del claim libera el pago en reject.
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

      const cancelResult = await cancelPaymentIntentOnReject(booking);
      if (!cancelResult.ok) {
        console.error(
          "[bookings/respond] No se pudo cancelar PaymentIntent al rechazar:",
          booking.payment_intent_id,
          cancelResult.error,
          { pi_status: cancelResult.pi_status },
        );
      }
    } catch (err) {
      console.error(
        "Error cancelando PaymentIntent al rechazar reserva:",
        booking.payment_intent_id,
        err?.message ?? err,
      );
    }
  }

  // Accept: no captura aquí (manual capture posterior). El claim a confirmada
  // impide que un reject posterior libere el hold.

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
          lugar_servicio,
          direccion_cliente_a_definir,
          services:service_id (
            titulo,
            modalidad,
            vertical,
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

          const contactFields = await buildProviderContactEmailFields({
            estado: "confirmada",
            serviceId: service.id || booking.service_id,
            service: svc,
            lugarServicio: bookingFull.lugar_servicio ?? null,
            telefonoFallback: proveedorProfile?.telefono || null,
            adminClient: supabaseAdmin,
          });

          const clienteContactRow = shouldShowClienteDireccionToProvider(
            bookingFull.lugar_servicio,
            svc.modalidad,
          )
            ? await loadBookingContactClienteAdmin(bookingId, supabaseAdmin)
            : null;

          await postBookingEmail(baseUrl, {
            tipo: "reserva_confirmada",
            solo_cliente: true,
            cliente_id: bookingFull.cliente_id,
            cliente_nombre: clienteNombre,
            proveedor_nombre: proveedorNombre,
            proveedor_id: proveedorId,
            service_id: service.id || booking.service_id,
            servicio_titulo: svc.titulo || "Servicio",
            fecha_inicio: bookingFull.fecha_inicio,
            fecha_fin: finEmail,
            precio_total: precioTotal,
            credito_aplicado: creditoAplicado,
            mensaje,
            modalidad: svc.modalidad,
            vertical: svc.vertical,
            ...contactFields,
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
            cliente_direccion: clienteContactRow?.direccion_cliente || undefined,
            cliente_direccion_a_definir:
              bookingFull.direccion_cliente_a_definir === true
                ? true
                : undefined,
            lugar_servicio: bookingFull.lugar_servicio || undefined,
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

  return NextResponse.json({
    success: true,
    estado: nuevoEstado,
    already_processed: false,
  });
}
