/**
 * Captura el PaymentIntent al confirmar la reserva (aceptar proveedor o
 * reserva inmediata). El dinero queda en la cuenta plataforma hasta el
 * transfer al completar el servicio (capturar-y-transferir).
 *
 * Idempotente: si el PI ya está "succeeded", no hace nada.
 */

/**
 * Columnas obligatorias del `.select(...)` tras `.insert(bookingRows)` en
 * complete/route.js. Debe incluir `estado` para capturar reservas inmediatas.
 */
export const COMPLETE_INSERT_SELECT_COLUMNS = [
  "id",
  "service_id",
  "estado",
  "fecha_inicio",
  "fecha_fin",
  "lugar_servicio",
  "direccion_cliente_a_definir",
  "payment_intent_id",
];

export const COMPLETE_INSERT_SELECT =
  COMPLETE_INSERT_SELECT_COLUMNS.join(", ");

/**
 * Rellena `estado` si el select de insert no lo devolvió, cruzando con
 * bookingRows por service_id.
 * @param {Array<object>} insertedBookings
 * @param {Array<{ service_id?: string, estado?: string }>|null|undefined} bookingRows
 */
export function enrichInsertedBookingsEstado(insertedBookings, bookingRows = []) {
  const estadoByServiceId = new Map();
  for (const row of bookingRows ?? []) {
    if (row?.service_id != null && row.estado != null) {
      estadoByServiceId.set(row.service_id, row.estado);
    }
  }

  return (insertedBookings ?? []).map((b) => ({
    ...b,
    estado: b.estado ?? estadoByServiceId.get(b.service_id) ?? null,
  }));
}

/**
 * PIs a capturar al crear reservas inmediatas (estado confirmada).
 * @param {Array<object>} insertedBookings — forma del select de insert
 * @param {Array<object>} [bookingRows] — filas enviadas al insert (fallback estado)
 */
export function collectImmediateCapturePiIds(
  insertedBookings,
  bookingRows = [],
) {
  const enriched = enrichInsertedBookingsEstado(insertedBookings, bookingRows);
  return [
    ...new Set(
      enriched
        .filter(
          (b) =>
            b.estado === "confirmada" &&
            typeof b.payment_intent_id === "string" &&
            b.payment_intent_id.length > 0,
        )
        .map((b) => b.payment_intent_id),
    ),
  ];
}

/**
 * @param {import("stripe").Stripe} stripe
 * @param {string | null | undefined} paymentIntentId
 * @param {{ idempotencyKey?: string }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   skipped?: boolean,
 *   already_captured?: boolean,
 *   paymentIntent?: object | null,
 *   pi_status?: string | null,
 *   error?: string,
 *   error_code?: string,
 * }>}
 */
export async function capturarPaymentIntentAlConfirmar(
  stripe,
  paymentIntentId,
  opts = {},
) {
  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return { ok: true, skipped: true, paymentIntent: null, pi_status: null };
  }

  const idempotencyKey =
    opts.idempotencyKey || `capture-on-confirm:${paymentIntentId}`;

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    return {
      ok: false,
      error: err?.message ?? String(err),
      error_code: "pi_retrieve_failed",
      pi_status: null,
      paymentIntent: null,
    };
  }

  if (paymentIntent.status === "succeeded") {
    return {
      ok: true,
      already_captured: true,
      paymentIntent,
      pi_status: paymentIntent.status,
    };
  }

  if (paymentIntent.status !== "requires_capture") {
    return {
      ok: false,
      error: `PaymentIntent no capturable al confirmar (estado: ${paymentIntent.status})`,
      error_code: "pi_not_capturable",
      pi_status: paymentIntent.status,
      paymentIntent,
    };
  }

  try {
    paymentIntent = await stripe.paymentIntents.capture(
      paymentIntentId,
      {},
      { idempotencyKey },
    );
    return {
      ok: true,
      paymentIntent,
      pi_status: paymentIntent.status,
    };
  } catch (captureErr) {
    if (
      captureErr?.code === "payment_intent_unexpected_state" ||
      /already been captured/i.test(captureErr?.message || "")
    ) {
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      } catch (retrieveErr) {
        return {
          ok: false,
          error: retrieveErr?.message ?? String(retrieveErr),
          error_code: "pi_retrieve_failed",
          pi_status: null,
          paymentIntent: null,
        };
      }
      if (paymentIntent.status === "succeeded") {
        return {
          ok: true,
          already_captured: true,
          paymentIntent,
          pi_status: paymentIntent.status,
        };
      }
    }

    return {
      ok: false,
      error: captureErr?.message ?? String(captureErr),
      error_code: "pi_capture_failed",
      pi_status: paymentIntent?.status ?? "requires_capture",
      paymentIntent: paymentIntent ?? null,
    };
  }
}

/**
 * Tras un fallo a mitad de confirmación (p. ej. captura parcial en bundle):
 * cancela holds o reembolsa PIs ya capturados.
 *
 * @param {import("stripe").Stripe} stripe
 * @param {string[]} paymentIntentIds
 * @param {{ reason?: string }} [opts]
 */
export async function liberarPaymentIntentsTrasFalloConfirmacion(
  stripe,
  paymentIntentIds,
  opts = {},
) {
  const reason = opts.reason || "confirm_abort";
  const unique = [
    ...new Set(
      (Array.isArray(paymentIntentIds) ? paymentIntentIds : [])
        .filter((id) => typeof id === "string" && id.length > 0),
    ),
  ];

  const results = [];

  for (const paymentIntentId of unique) {
    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);
      const { status } = paymentIntent;

      if (status === "canceled") {
        results.push({ paymentIntentId, action: "already_canceled" });
        continue;
      }

      if (status === "requires_capture") {
        await stripe.paymentIntents.cancel(
          paymentIntentId,
          {},
          {
            idempotencyKey: `cancel-pi:${reason}:${paymentIntentId}`,
          },
        );
        results.push({ paymentIntentId, action: "canceled" });
        continue;
      }

      if (status === "succeeded") {
        const amount = Number(paymentIntent.amount) || 0;
        if (amount > 0) {
          await stripe.refunds.create(
            {
              payment_intent: paymentIntentId,
              amount,
            },
            {
              idempotencyKey: `refund:${reason}:${paymentIntentId}:${amount}`,
            },
          );
        }
        results.push({ paymentIntentId, action: "refunded", amount });
        continue;
      }

      results.push({
        paymentIntentId,
        action: "skipped",
        status,
      });
    } catch (err) {
      const message = (err?.message || "").toLowerCase();
      if (
        err?.code === "payment_intent_unexpected_state" ||
        message.includes("already been canceled") ||
        message.includes("already been refunded")
      ) {
        results.push({
          paymentIntentId,
          action: "already_done",
          error: err?.message,
        });
        continue;
      }
      console.error(
        "[capturar-al-confirmar] Error liberando PI tras fallo:",
        paymentIntentId,
        err?.message ?? err,
      );
      results.push({
        paymentIntentId,
        action: "error",
        error: err?.message ?? String(err),
      });
    }
  }

  return results;
}
