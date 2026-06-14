import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { readFileSync } from "fs";

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore missing file
  }
}

loadEnv(".env.local");
loadEnv(".env");

const BOOKING_ID = "6ff8719f-0b05-4616-a9bc-ceb1a6c181f7";
const PROVEEDOR_ID = "c7a0e290-266e-4d75-96b8-675e9cca4ea9";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  console.log("=== Diagnóstico capture-payment ===\n");

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, payment_intent_id, pago_liberado_at, precio_total, estado, service_id",
    )
    .eq("id", BOOKING_ID)
    .single();

  if (bookingError || !booking) {
    console.error("Booking no encontrado:", bookingError?.message);
    process.exit(1);
  }

  console.log("BOOKING:");
  console.log(JSON.stringify(booking, null, 2));

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, stripe_account_id, deuda_pendiente")
    .eq("id", PROVEEDOR_ID)
    .single();

  if (profileError || !profile) {
    console.error("Perfil proveedor no encontrado:", profileError?.message);
  } else {
    console.log("\nPROVEEDOR (Paula):");
    console.log(JSON.stringify(profile, null, 2));
  }

  const piId = booking.payment_intent_id;
  if (!piId) {
    console.log("\nSin payment_intent_id en la reserva.");
    process.exit(0);
  }

  console.log("\n--- Stripe PaymentIntent ---");
  const pi = await stripe.paymentIntents.retrieve(piId, {
    expand: ["latest_charge"],
  });

  console.log("id:", pi.id);
  console.log("status:", pi.status);
  console.log("amount:", pi.amount, "cents (", pi.amount / 100, "EUR )");
  console.log("capture_method:", pi.capture_method);
  console.log("latest_charge:", pi.latest_charge?.id ?? pi.latest_charge ?? null);

  if (pi.latest_charge && typeof pi.latest_charge === "object") {
    const ch = pi.latest_charge;
    console.log("charge status:", ch.status);
    console.log("charge amount:", ch.amount / 100, "EUR");
    console.log("charge captured:", ch.captured);
  }

  console.log("\n--- Transfers asociadas al charge ---");
  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id;

  if (chargeId) {
    const transfers = await stripe.transfers.list({
      limit: 20,
    });
    const related = transfers.data.filter(
      (t) => t.source_transaction === chargeId,
    );
    if (related.length === 0) {
      console.log("Ninguna transfer con source_transaction =", chargeId);
      console.log(
        "(Últimas transfers en la cuenta platform:",
        transfers.data.length,
        ")",
      );
    } else {
      for (const t of related) {
        console.log(JSON.stringify({
          id: t.id,
          amount: t.amount / 100,
          destination: t.destination,
          created: new Date(t.created * 1000).toISOString(),
        }));
      }
    }
  } else {
    console.log("No hay charge id — no se pudo listar transfers.");
  }

  const accountId = profile?.stripe_account_id;
  if (!accountId) {
    console.log("\nProveedor sin stripe_account_id.");
    process.exit(0);
  }

  console.log("\n--- Stripe Connect account ---");
  const account = await stripe.accounts.retrieve(accountId);

  console.log("id:", account.id);
  console.log("type:", account.type);
  console.log("charges_enabled:", account.charges_enabled);
  console.log("payouts_enabled:", account.payouts_enabled);
  console.log("details_submitted:", account.details_submitted);
  console.log("capabilities:", JSON.stringify(account.capabilities, null, 2));

  if (account.requirements?.currently_due?.length) {
    console.log(
      "requirements.currently_due:",
      account.requirements.currently_due,
    );
  }
  if (account.requirements?.disabled_reason) {
    console.log("disabled_reason:", account.requirements.disabled_reason);
  }

  console.log("\n=== Fin diagnóstico ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  if (err.raw) console.error(JSON.stringify(err.raw, null, 2));
  process.exit(1);
});
