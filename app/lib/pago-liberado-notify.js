/**
 * Aviso al proveedor cuando se libera el pago de una reserva.
 * Idempotente (notif unique + email_logs). Nunca debe romper el flujo de pago.
 */

import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/app/lib/notifications";
import { getIngresoProveedorFromBooking, roundMoney } from "@/app/lib/ingresos-proveedor";

const LOG_PREFIX = "[pago-liberado-notify]";
export const PAGO_LIBERADO_TIPO = "pago_liberado";
export const PAGO_LIBERADO_EMAIL_TIPO = "pago_liberado_proveedor";
export const PAGO_LIBERADO_HREF = "/dashboard?tab=proveedor";

function getServiceAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function formatEuro(amount) {
  const n = roundMoney(amount);
  return `${n.toFixed(2).replace(".", ",")}€`;
}

/**
 * Notifica al proveedor (in-app + email) de que el pago de una reserva está liberado.
 * No lanza excepciones.
 * @param {string} bookingId
 * @returns {Promise<{ ok: boolean, notified?: boolean, emailSent?: boolean, skipped?: boolean }>}
 */
export async function notifyProveedorPagoLiberado(bookingId) {
  try {
    if (!bookingId) {
      return { ok: false, skipped: true };
    }

    const admin = getServiceAdmin();
    if (!admin) {
      console.error(LOG_PREFIX, "Sin cliente service role");
      return { ok: false };
    }

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        `
        id,
        importe_transferido,
        precio_total,
        precio_base,
        cliente_sin_comision,
        proveedor_sin_comision,
        pago_liberado_at,
        service_id,
        services:service_id (
          id,
          titulo,
          proveedor_id,
          profiles!proveedor_id (id, nombre, apellido)
        )
      `,
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error(
        LOG_PREFIX,
        "Booking no encontrado:",
        bookingError?.message || bookingId,
      );
      return { ok: false };
    }

    const service = booking.services;
    const proveedorId = service?.proveedor_id;
    if (!proveedorId) {
      console.error(LOG_PREFIX, "Sin proveedor_id", bookingId);
      return { ok: false };
    }

    const tituloServicio =
      String(service?.titulo || "").trim() || "tu servicio";
    const importe =
      booking.importe_transferido != null && booking.importe_transferido !== ""
        ? roundMoney(Number(booking.importe_transferido))
        : getIngresoProveedorFromBooking(booking);
    const importeLabel = formatEuro(importe);

    const nombre = [service?.profiles?.nombre, service?.profiles?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim() || "proveedor";

    const titulo = "Has recibido un pago";
    const mensaje = `Has cobrado ${importeLabel} por «${tituloServicio}».`;

    let notified = false;
    const notifResult = await createNotification(null, {
      user_id: proveedorId,
      tipo: PAGO_LIBERADO_TIPO,
      titulo,
      mensaje,
      href: PAGO_LIBERADO_HREF,
      entity_type: "booking",
      entity_id: bookingId,
    });

    if (notifResult.ok && !notifResult.duplicate) {
      notified = true;
    }

    let emailSent = false;
    try {
      const { data: existingLog } = await admin
        .from("email_logs")
        .select("id")
        .eq("user_id", proveedorId)
        .eq("tipo", PAGO_LIBERADO_EMAIL_TIPO)
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (!existingLog) {
        const baseUrl = process.env.NEXT_PUBLIC_URL;
        if (!baseUrl) {
          console.error(LOG_PREFIX, "NEXT_PUBLIC_URL no configurada, email omitido");
        } else {
          const res = await fetch(`${baseUrl}/api/emails`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: PAGO_LIBERADO_EMAIL_TIPO,
              user_id: proveedorId,
              nombre,
              titulo: tituloServicio,
              importe: importeLabel,
              importe_num: importe,
              booking_id: bookingId,
            }),
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            console.error(
              LOG_PREFIX,
              "Email falló:",
              payload.error || res.status,
            );
          } else {
            emailSent = true;
          }
        }
      }
    } catch (emailErr) {
      console.error(LOG_PREFIX, "Email excepción:", emailErr?.message || emailErr);
    }

    return { ok: true, notified, emailSent };
  } catch (err) {
    console.error(LOG_PREFIX, "Error:", err?.message || err);
    return { ok: false };
  }
}

/**
 * Avisa por cada booking liberado. Nunca lanza.
 * @param {string[]} bookingIds
 * @param {string} [logPrefix]
 */
export async function notifyProveedoresPagosLiberados(
  bookingIds,
  logPrefix = LOG_PREFIX,
) {
  const ids = [...new Set((bookingIds || []).filter(Boolean))];
  for (const bookingId of ids) {
    try {
      await notifyProveedorPagoLiberado(bookingId);
    } catch (err) {
      console.error(
        logPrefix,
        "notifyProveedorPagoLiberado falló (pago no afectado):",
        bookingId,
        err?.message || err,
      );
    }
  }
}
