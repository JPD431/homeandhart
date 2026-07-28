import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { authorizeAdminOrCron } from "@/app/lib/stripe-api-auth";
import { createStripeTransferWithIdempotency } from "@/app/lib/transfer-proveedor";
import {
  getIngresoProveedorFromBooking,
  roundMoney,
} from "@/app/lib/ingresos-proveedor";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STRIPE_MIN_TRANSFER_EUR = 0.5;

function chargeIdFromPaymentIntent(paymentIntent) {
  const latest = paymentIntent?.latest_charge;
  if (typeof latest === "string" && latest.startsWith("ch_")) return latest;
  if (latest && typeof latest === "object" && typeof latest.id === "string") {
    return latest.id;
  }
  return null;
}

/**
 * Agrupa bookings del PI por proveedor con destino e importe disponible desde BD.
 */
async function loadProveedorPlansForPaymentIntent(paymentIntentId) {
  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      id,
      service_id,
      precio_total,
      precio_base,
      cliente_sin_comision,
      proveedor_sin_comision,
      importe_transferido,
      pago_liberado_at,
      services:service_id (
        id,
        proveedor_id,
        profiles:proveedor_id (
          id,
          stripe_account_id
        )
      )
    `,
    )
    .eq("payment_intent_id", paymentIntentId);

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  if (!bookings?.length) {
    return {
      error: "No hay reservas asociadas a ese paymentIntentId",
      status: 404,
      plans: [],
    };
  }

  const byProveedor = new Map();

  for (const booking of bookings) {
    const service = booking.services;
    const proveedorId = service?.proveedor_id;
    const profile = service?.profiles;
    const stripeAccountId = profile?.stripe_account_id || null;

    if (!proveedorId) continue;

    if (!byProveedor.has(proveedorId)) {
      byProveedor.set(proveedorId, {
        proveedorId,
        stripe_account_id: stripeAccountId,
        bookings: [],
        due: 0,
        already: 0,
      });
    }

    const entry = byProveedor.get(proveedorId);
    if (!entry.stripe_account_id && stripeAccountId) {
      entry.stripe_account_id = stripeAccountId;
    }

    const due = getIngresoProveedorFromBooking(booking);
    const already = roundMoney(Number(booking.importe_transferido) || 0);
    entry.bookings.push(booking);
    entry.due = roundMoney(entry.due + due);
    entry.already = roundMoney(entry.already + already);
  }

  const plans = [...byProveedor.values()].map((entry) => ({
    ...entry,
    available: roundMoney(Math.max(0, entry.due - entry.already)),
  }));

  return { plans, bookings };
}

function resolveRequestedTransfers(body, plans) {
  const {
    bookingId = null,
    proveedorId = null,
    amount = null,
    proveedores = null,
  } = body ?? {};

  // Forma preferida: un proveedor concreto (vía bookingId o proveedorId).
  if (bookingId || proveedorId || amount != null) {
    let resolvedProveedorId = proveedorId;

    if (bookingId) {
      const planForBooking = plans.find((p) =>
        p.bookings.some((b) => b.id === bookingId),
      );
      if (!planForBooking) {
        return {
          error: "bookingId no pertenece a este paymentIntentId",
          status: 400,
        };
      }
      if (
        resolvedProveedorId &&
        resolvedProveedorId !== planForBooking.proveedorId
      ) {
        return {
          error: "proveedorId no coincide con el proveedor del booking",
          status: 400,
        };
      }
      resolvedProveedorId = planForBooking.proveedorId;
    }

    if (!resolvedProveedorId) {
      if (plans.length === 1) {
        resolvedProveedorId = plans[0].proveedorId;
      } else {
        return {
          error:
            "Indica bookingId o proveedorId: este pago tiene varios proveedores",
          status: 400,
        };
      }
    }

    const plan = plans.find((p) => p.proveedorId === resolvedProveedorId);
    if (!plan) {
      return {
        error: "proveedorId no tiene reservas en este pago",
        status: 400,
      };
    }

    return {
      items: [
        {
          plan,
          requestedAmount:
            amount != null && amount !== "" ? Number(amount) : null,
        },
      ],
    };
  }

  // Forma legacy: proveedores[]. Solo se acepta proveedorId (o stripe_account_id
  // como identificador para resolver el proveedor en BD; el destino sale de BD).
  if (Array.isArray(proveedores) && proveedores.length > 0) {
    const items = [];
    for (const raw of proveedores) {
      let plan = null;
      if (raw?.proveedorId) {
        plan = plans.find((p) => p.proveedorId === raw.proveedorId) || null;
      } else if (raw?.stripe_account_id) {
        // Identificación opcional; NUNCA se usa como destination final.
        plan =
          plans.find((p) => p.stripe_account_id === raw.stripe_account_id) ||
          null;
      }

      if (!plan) {
        return {
          error:
            "Cada entrada de proveedores debe incluir proveedorId (o un stripe_account_id que coincida con el proveedor del pago en BD)",
          status: 400,
        };
      }

      items.push({
        plan,
        requestedAmount:
          raw?.amount != null && raw?.amount !== "" ? Number(raw.amount) : null,
      });
    }
    return { items };
  }

  if (plans.length === 1) {
    return { items: [{ plan: plans[0], requestedAmount: null }] };
  }

  return {
    error:
      "Indica bookingId, proveedorId o proveedores[{proveedorId}] para atar la transfer a un proveedor concreto",
    status: 400,
  };
}

function resolveTransferAmount(plan, requestedAmount) {
  if (!plan.stripe_account_id) {
    return {
      error: `El proveedor ${plan.proveedorId} no tiene stripe_account_id en BD`,
      status: 400,
    };
  }

  if (plan.available <= 0) {
    return {
      error: `No queda importe por transferir al proveedor ${plan.proveedorId} (debido ${plan.due}€, ya transferido ${plan.already}€)`,
      status: 409,
    };
  }

  let amountEur = plan.available;
  if (requestedAmount != null) {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return { error: "amount inválido", status: 400 };
    }
    const requested = roundMoney(requestedAmount);
    if (requested > plan.available + 0.001) {
      return {
        error: `amount (${requested}€) supera lo disponible (${plan.available}€) para el proveedor`,
        status: 400,
        available: plan.available,
        due: plan.due,
        already: plan.already,
      };
    }
    amountEur = requested;
  }

  if (amountEur < STRIPE_MIN_TRANSFER_EUR) {
    return {
      error: `El importe a transferir (${amountEur}€) es inferior al mínimo de Stripe (${STRIPE_MIN_TRANSFER_EUR}€)`,
      status: 400,
    };
  }

  return { amountEur: roundMoney(amountEur) };
}

/**
 * Reparte el importe transferido entre bookings del plan (proporcional al ingreso debido).
 */
function splitImporteTransferido(amountEur, plan) {
  const dues = plan.bookings.map((b) => ({
    id: b.id,
    due: getIngresoProveedorFromBooking(b),
    already: roundMoney(Number(b.importe_transferido) || 0),
  }));
  const totalDue = dues.reduce((s, d) => s + d.due, 0);
  if (totalDue <= 0 || dues.length === 1) {
    return dues.map((d, i) => ({
      bookingId: d.id,
      amount: i === 0 ? amountEur : 0,
    }));
  }

  const parts = [];
  let assigned = 0;
  for (let i = 0; i < dues.length; i++) {
    if (i === dues.length - 1) {
      parts.push({
        bookingId: dues[i].id,
        amount: roundMoney(amountEur - assigned),
      });
    } else {
      const share = roundMoney((amountEur * dues[i].due) / totalDue);
      parts.push({ bookingId: dues[i].id, amount: share });
      assigned = roundMoney(assigned + share);
    }
  }
  return parts;
}

export async function POST(request) {
  try {
    const auth = await authorizeAdminOrCron(request);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    let paymentIntentId =
      typeof body?.paymentIntentId === "string" ? body.paymentIntentId : null;
    const bookingId =
      typeof body?.bookingId === "string" ? body.bookingId : null;

    if (!paymentIntentId && bookingId) {
      const { data: bookingRow, error: bookingErr } = await supabaseAdmin
        .from("bookings")
        .select("id, payment_intent_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingErr) {
        return Response.json({ error: bookingErr.message }, { status: 500 });
      }
      if (!bookingRow) {
        return Response.json(
          { error: "Reserva no encontrada" },
          { status: 404 },
        );
      }
      paymentIntentId = bookingRow.payment_intent_id || null;
    }

    if (!paymentIntentId) {
      return Response.json(
        {
          error:
            "Falta paymentIntentId o bookingId con payment_intent_id en BD",
        },
        { status: 400 },
      );
    }

    const loaded = await loadProveedorPlansForPaymentIntent(paymentIntentId);
    if (loaded.error) {
      return Response.json(
        { error: loaded.error },
        { status: loaded.status || 400 },
      );
    }

    const resolved = resolveRequestedTransfers(
      { ...body, bookingId, paymentIntentId },
      loaded.plans,
    );
    if (resolved.error) {
      return Response.json(
        { error: resolved.error },
        { status: resolved.status || 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return Response.json(
        {
          error: `El PaymentIntent no está capturado (estado: ${paymentIntent.status}). No se puede obtener un Charge para source_transaction.`,
          pi_status: paymentIntent.status,
        },
        { status: 400 },
      );
    }

    const chargeId = chargeIdFromPaymentIntent(paymentIntent);
    if (!chargeId) {
      return Response.json(
        {
          error:
            "No se pudo obtener el Charge id (ch_...) del PaymentIntent. latest_charge vacío.",
          payment_intent_id: paymentIntentId,
        },
        { status: 400 },
      );
    }

    const transfers = [];
    const summaries = [];

    for (const item of resolved.items) {
      const amountResolved = resolveTransferAmount(
        item.plan,
        item.requestedAmount,
      );
      if (amountResolved.error) {
        return Response.json(
          {
            error: amountResolved.error,
            available: amountResolved.available,
            due: amountResolved.due,
            already: amountResolved.already,
            proveedorId: item.plan.proveedorId,
          },
          { status: amountResolved.status || 400 },
        );
      }

      const { amountEur } = amountResolved;
      const destination = item.plan.stripe_account_id;
      const amountCents = Math.round(amountEur * 100);
      // Incluye céntimos para que un segundo pago parcial legítimo no colisione
      // con la idempotency del primero; el mismo reintento reutiliza la misma key.
      const idempotencyKey = `transfer:admin-connect:${paymentIntentId}:${item.plan.proveedorId}:${amountCents}`;

      const transfer = await createStripeTransferWithIdempotency(
        stripe,
        {
          amount: amountCents,
          currency: "eur",
          destination,
          source_transaction: chargeId,
        },
        idempotencyKey,
      );

      const splits = splitImporteTransferido(amountEur, item.plan);
      const liberadoAt = new Date().toISOString();
      for (const { bookingId: splitBookingId, amount } of splits) {
        const booking = item.plan.bookings.find((b) => b.id === splitBookingId);
        const expectedPrev = roundMoney(
          Number(booking?.importe_transferido) || 0,
        );
        const next = roundMoney(expectedPrev + amount);

        // Evita doble conteo si Stripe devolvió la misma transfer en un reintento
        // tras haber persistido ya el importe.
        const { data: freshRow } = await supabaseAdmin
          .from("bookings")
          .select("importe_transferido, pago_liberado_at")
          .eq("id", splitBookingId)
          .maybeSingle();
        const freshImporte = roundMoney(
          Number(freshRow?.importe_transferido) || 0,
        );
        if (freshImporte >= next - 0.001) {
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from("bookings")
          .update({
            importe_transferido: next,
            pago_liberado_at: freshRow?.pago_liberado_at || liberadoAt,
          })
          .eq("id", splitBookingId);

        if (updateError) {
          console.error(
            "[admin connect/transfer] Error actualizando booking tras transfer:",
            splitBookingId,
            updateError.message,
          );
        }
      }

      transfers.push(transfer);
      summaries.push({
        proveedorId: item.plan.proveedorId,
        stripe_account_id: destination,
        amount: amountEur,
        charge_id: chargeId,
        transfer_id: transfer.id,
        booking_ids: item.plan.bookings.map((b) => b.id),
        due: item.plan.due,
        already_before: item.plan.already,
        available_before: item.plan.available,
      });
    }

    return Response.json({
      success: true,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId,
      transfers,
      summaries,
    });
  } catch (error) {
    console.error("[admin connect/transfer]", error?.message ?? error);
    return Response.json(
      { error: error?.message || "Error en transferencia" },
      { status: 500 },
    );
  }
}
