import { roundMoney } from "@/app/lib/ingresos-proveedor";
import { resolveConnectDestinationForPayout } from "@/app/lib/connect-account";
import { alertStripeDescuadre } from "@/app/lib/stripe-descuadre-alert";

/** Mínimo de Stripe para crear una transfer a cuenta Connect (EUR). */
export const STRIPE_MIN_TRANSFER_EUR = 0.5;

/**
 * Crea una Transfer de Stripe con idempotency key obligatoria (anti doble payout).
 * Reintentos con la misma key devuelven la misma transfer, no una nueva.
 *
 * @param {import("stripe").Stripe} stripe
 * @param {object} transferParams
 * @param {string} idempotencyKey clave estable (ej. transfer:pi_xxx:proveedorUuid)
 */
export async function createStripeTransferWithIdempotency(
  stripe,
  transferParams,
  idempotencyKey,
) {
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("idempotencyKey es obligatoria para transfers.create");
  }
  return stripe.transfers.create(transferParams, { idempotencyKey });
}

/**
 * Calcula deuda, saldo acumulado y si hace falta transferir (misma lógica que capture-payment).
 *
 * @param {number} amountBruto Importe bruto a repartir al proveedor en este ciclo.
 * @param {{ deuda_pendiente?: number|string, saldo_pendiente_transferir?: number|string }} profile
 */
export function prepareTransferConDeudaSaldo(amountBruto, profile) {
  const deuda_actual = roundMoney(profile?.deuda_pendiente);
  const deuda_a_descontar = Math.min(deuda_actual, amountBruto);
  const amount_este_ciclo = roundMoney(amountBruto - deuda_a_descontar);
  const saldo_pendiente_anterior = roundMoney(
    profile?.saldo_pendiente_transferir,
  );
  const total_a_transferir = roundMoney(
    saldo_pendiente_anterior + amount_este_ciclo,
  );
  const deuda_restante = roundMoney(
    Math.max(0, deuda_actual - deuda_a_descontar),
  );

  return {
    deuda_actual,
    deuda_a_descontar,
    amount_este_ciclo,
    saldo_pendiente_anterior,
    total_a_transferir,
    transfer_required: total_a_transferir >= STRIPE_MIN_TRANSFER_EUR,
    deuda_restante,
  };
}

/**
 * Descuenta deuda, acumula saldo si no llega al mínimo y transfiere a Connect.
 * Actualiza profiles solo si la operación termina bien (transfer OK o acumulación en saldo).
 *
 * @param {object} params
 * @param {import("stripe").Stripe} params.stripe
 * @param {import("@supabase/supabase-js").SupabaseClient} params.supabase
 * @param {string} params.proveedorId
 * @param {string|null} params.stripeAccountId
 * @param {object} params.profile Perfil del proveedor (deuda, saldo, cobros_activos).
 * @param {number} params.amountBruto parte_proveedor antes de deuda/saldo.
 * @param {string|null} params.chargeId Charge de Stripe para source_transaction (null = solo balance).
 * @param {boolean} params.usePlatformBalance Si true, transfer sin source_transaction.
 * @param {string} params.idempotencyKey Clave Stripe estable (requerida si hay transfer).
 * @param {string} [params.logPrefix]
 */
export async function ejecutarTransferProveedorConDeudaSaldo({
  stripe,
  supabase,
  proveedorId,
  stripeAccountId,
  profile,
  amountBruto,
  chargeId,
  usePlatformBalance,
  idempotencyKey,
  logPrefix = "[transfer-proveedor]",
}) {
  const cobrosActivos = profile?.cobros_activos === true;
  const prepared = prepareTransferConDeudaSaldo(amountBruto, profile);
  const financiamiento = usePlatformBalance ? "balance_plataforma" : "cargo";

  const summary = {
    success: false,
    skipped: false,
    error: null,
    amount_bruto: roundMoney(amountBruto),
    ...prepared,
    transferido_stripe: 0,
    deuda_descontada: 0,
    financiamiento,
    cobros_activos: cobrosActivos,
    transfer_attempted: false,
  };

  if (amountBruto <= 0) {
    summary.skipped = true;
    summary.success = true;
    return summary;
  }

  if (!stripeAccountId && !proveedorId) {
    summary.error = "Proveedor sin stripe_account_id";
    return summary;
  }

  try {
    let saldo_pendiente_nuevo = prepared.saldo_pendiente_anterior;
    let destination = stripeAccountId;

    if (prepared.transfer_required && cobrosActivos) {
      // M7: cuenta ACTUAL del perfil + validación Stripe antes de transferir.
      const resolved = await resolveConnectDestinationForPayout(
        stripe,
        supabase,
        proveedorId,
      );
      if (!resolved.ok) {
        summary.error = resolved.error;
        summary.skip_reason = "cuenta_connect_invalida";
        await alertStripeDescuadre({
          eventId: `payout-cuenta:${idempotencyKey || proveedorId}`,
          eventType: "internal.payout_cuenta_invalida",
          kind: "payout_cuenta_invalida",
          summary: `Payout bloqueado: cuenta Connect inválida para proveedor ${proveedorId}.`,
          paymentIntentId: null,
          bookingIds: [],
          details: {
            proveedor_id: proveedorId,
            stripe_account_id: resolved.stripeAccountId,
            reason: resolved.reason,
            error: resolved.error,
            accion:
              "El importe queda pendiente de reintento. El proveedor debe completar/reactivar Connect; el cron o un admin reintentará el payout.",
          },
        });
        return summary;
      }
      destination = resolved.stripeAccountId;

      summary.transfer_attempted = true;
      const transferParams = {
        amount: Math.round(prepared.total_a_transferir * 100),
        currency: "eur",
        destination,
      };

      if (!usePlatformBalance && chargeId) {
        transferParams.source_transaction = chargeId;
      }

      await createStripeTransferWithIdempotency(
        stripe,
        transferParams,
        idempotencyKey,
      );
      summary.transferido_stripe = prepared.total_a_transferir;
      saldo_pendiente_nuevo = 0;
    } else if (prepared.total_a_transferir > 0) {
      saldo_pendiente_nuevo = prepared.total_a_transferir;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        deuda_pendiente: prepared.deuda_restante,
        saldo_pendiente_transferir: saldo_pendiente_nuevo,
      })
      .eq("id", proveedorId);

    if (profileError) {
      throw profileError;
    }

    summary.deuda_descontada = prepared.deuda_a_descontar;
    summary.saldo_pendiente_nuevo = saldo_pendiente_nuevo;
    summary.success = true;

    if (prepared.transfer_required && !cobrosActivos) {
      summary.skipped_transfer = true;
      summary.skip_reason = "cobros_inactivos";
    } else if (!prepared.transfer_required && prepared.total_a_transferir > 0) {
      summary.skipped_transfer = true;
      summary.skip_reason = "bajo_minimo_stripe";
    }

    return summary;
  } catch (err) {
    const errorMessage = err?.message ?? String(err);
    summary.error = errorMessage;
    console.error(
      `${logPrefix} Error transfiriendo al proveedor`,
      proveedorId,
      errorMessage,
    );
    return summary;
  }
}
