import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function getPrecioBase(precioTotal) {
  return (Number(precioTotal) || 0) / 1.14;
}

async function isProviderFirstCompletion(proveedorId, paymentIntentId) {
  const { data: services } = await supabase
    .from("services")
    .select("id")
    .eq("proveedor_id", proveedorId);

  const serviceIds = (services ?? []).map((s) => s.id);
  if (serviceIds.length === 0) return false;

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("service_id", serviceIds)
    .eq("estado", "completada")
    .neq("payment_intent_id", paymentIntentId);

  return (count ?? 0) === 0;
}

async function rewardReferrerIfFirstCompletion(proveedorId, proveedorProfile, paymentIntentId) {
  if (!proveedorProfile?.referido_por) return;

  const isFirst = await isProviderFirstCompletion(proveedorId, paymentIntentId);
  if (!isFirst) return;

  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, reservas_sin_comision, referidos_count")
    .eq("codigo_referido", proveedorProfile.referido_por)
    .maybeSingle();

  if (!referrer) return;

  await supabase
    .from("profiles")
    .update({
      reservas_sin_comision: (Number(referrer.reservas_sin_comision) || 0) + 1,
      referidos_count: (Number(referrer.referidos_count) || 0) + 1,
    })
    .eq("id", referrer.id);
}

async function buildTransfersForPayment(paymentIntentId) {
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, service_id, precio_total")
    .eq("payment_intent_id", paymentIntentId);

  if (bookingsError || !bookings?.length) return [];

  const serviceIds = [...new Set(bookings.map((b) => b.service_id).filter(Boolean))];
  if (serviceIds.length === 0) return [];

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select(
      `
      id,
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id,
        reservas_sin_comision,
        referido_por
      )
    `,
    )
    .in("id", serviceIds);

  if (servicesError || !services?.length) return [];

  const proveedorMap = new Map();

  for (const service of services) {
    const proveedorId = service.proveedor_id;
    const profile = service.profiles;
    if (!proveedorId || !profile?.stripe_account_id) continue;

    if (!proveedorMap.has(proveedorId)) {
      proveedorMap.set(proveedorId, {
        proveedorId,
        stripe_account_id: profile.stripe_account_id,
        reservas_sin_comision: Number(profile.reservas_sin_comision) || 0,
        referido_por: profile.referido_por,
        profile,
        serviceIds: new Set(),
        amount: 0,
      });
    }

    proveedorMap.get(proveedorId).serviceIds.add(service.id);
  }

  for (const booking of bookings) {
    for (const entry of proveedorMap.values()) {
      if (!entry.serviceIds.has(booking.service_id)) continue;
      entry.amount += getPrecioBase(booking.precio_total);
    }
  }

  const transfers = [];

  for (const entry of proveedorMap.values()) {
    if (entry.amount <= 0) continue;

    const sinComision = entry.reservas_sin_comision > 0;
    transfers.push({
      proveedorId: entry.proveedorId,
      stripe_account_id: entry.stripe_account_id,
      amount: sinComision ? entry.amount : entry.amount * 0.96,
      profile: entry.profile,
      decrementSinComision: sinComision,
    });
  }

  return transfers;
}

export async function POST(request) {
  try {
    const { paymentIntentId, bookingId } = await request.json();

    let resolvedPaymentIntentId = paymentIntentId;

    if (!resolvedPaymentIntentId && bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("payment_intent_id")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking?.payment_intent_id) {
        return Response.json(
          { error: "No se encontró payment_intent_id para esta reserva" },
          { status: 400 },
        );
      }

      resolvedPaymentIntentId = booking.payment_intent_id;
    }

    if (!resolvedPaymentIntentId) {
      return Response.json(
        { error: "Falta paymentIntentId o bookingId" },
        { status: 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.capture(resolvedPaymentIntentId);
    const chargeId = paymentIntent.latest_charge;

    const transferPlan = await buildTransfersForPayment(resolvedPaymentIntentId);

    let transfers = [];
    if (transferPlan.length && chargeId) {
      transfers = await Promise.all(
        transferPlan.map((p) =>
          stripe.transfers.create({
            amount: Math.round(p.amount * 100),
            currency: "eur",
            destination: p.stripe_account_id,
            source_transaction: chargeId,
          }),
        ),
      );

      for (const plan of transferPlan) {
        if (plan.decrementSinComision) {
          const current = Number(plan.profile.reservas_sin_comision) || 0;
          await supabase
            .from("profiles")
            .update({ reservas_sin_comision: Math.max(0, current - 1) })
            .eq("id", plan.proveedorId);
        }

        await rewardReferrerIfFirstCompletion(
          plan.proveedorId,
          plan.profile,
          resolvedPaymentIntentId,
        );
      }
    }

    return Response.json({ success: true, paymentIntent, transfers });
  } catch (error) {
    console.error("Error capture-payment:", error.message, error.type, error.code);
    return Response.json(
      { error: error.message, type: error.type, code: error.code },
      { status: 500 },
    );
  }
}
