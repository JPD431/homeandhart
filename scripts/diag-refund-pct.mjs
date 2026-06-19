/**
 * Script temporal: % reembolso si se cancelara ahora.
 * Uso: node scripts/diag-refund-pct.mjs <booking_id>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getRefundPercent,
  getServiceStartDateTime,
  normalizeCancelPolicy,
} from "../app/lib/cancelacion-politica.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const bookingId =
  process.argv[2] || "6409486e-37e4-43e7-8cce-02e6241162e5";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: booking, error } = await supabase
  .from("bookings")
  .select(
    `
    id,
    fecha_inicio,
    hora,
    precio_total,
    payment_intent_id,
    estado,
    services:service_id (
      cancellation_policy,
      vertical,
      titulo
    )
  `,
  )
  .eq("id", bookingId)
  .maybeSingle();

if (error) {
  console.error("Error Supabase:", error.message);
  process.exit(1);
}

if (!booking) {
  console.error("Booking no encontrado:", bookingId);
  process.exit(1);
}

const service = booking.services;
const now = new Date();
const serviceStartAt = getServiceStartDateTime(
  service?.vertical,
  booking.fecha_inicio,
  booking.hora,
);

const policy = service?.cancellation_policy ?? null;
const policyKey = policy ? normalizeCancelPolicy(policy) : null;

let hoursUntil = null;
if (serviceStartAt) {
  hoursUntil =
    (serviceStartAt.getTime() - now.getTime()) / (1000 * 60 * 60);
}

const pct = getRefundPercent(policy, now, serviceStartAt);

console.log(JSON.stringify({
  booking_id: booking.id,
  estado: booking.estado,
  titulo: service?.titulo,
  vertical: service?.vertical,
  fecha_inicio: booking.fecha_inicio,
  hora: booking.hora,
  precio_total: booking.precio_total,
  payment_intent_id: booking.payment_intent_id,
  cancellation_policy_raw: policy,
  cancellation_policy_normalized: policyKey,
  cancelacion_simulada_en: now.toISOString(),
  service_start_at: serviceStartAt?.toISOString() ?? null,
  horas_hasta_inicio: hoursUntil != null ? Math.round(hoursUntil * 100) / 100 : null,
  dias_hasta_inicio: hoursUntil != null ? Math.round((hoursUntil / 24) * 100) / 100 : null,
  pct_reembolso: pct,
}, null, 2));
