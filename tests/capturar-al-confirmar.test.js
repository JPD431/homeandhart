import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  capturarPaymentIntentAlConfirmar,
  liberarPaymentIntentsTrasFalloConfirmacion,
} from "@/app/lib/capturar-al-confirmar";

function makeStripe({
  status = "requires_capture",
  amount = 11400,
  captureImpl,
  cancelImpl,
  refundImpl,
  retrieveSequence,
} = {}) {
  const piBase = {
    id: "pi_test_1",
    status,
    amount,
    latest_charge: "ch_test_1",
  };

  let retrieveCount = 0;
  const retrieve = vi.fn(async () => {
    if (Array.isArray(retrieveSequence)) {
      const next = retrieveSequence[Math.min(retrieveCount, retrieveSequence.length - 1)];
      retrieveCount += 1;
      return { ...piBase, ...next };
    }
    return { ...piBase };
  });

  const capture = vi.fn(
    captureImpl ||
      (async () => ({
        ...piBase,
        status: "succeeded",
      })),
  );
  const cancel = vi.fn(cancelImpl || (async () => ({ ...piBase, status: "canceled" })));
  const createRefund = vi.fn(
    refundImpl || (async () => ({ id: "re_test", amount })),
  );

  return {
    paymentIntents: { retrieve, capture, cancel },
    refunds: { create: createRefund },
    _mocks: { retrieve, capture, cancel, createRefund },
  };
}

describe("capturarPaymentIntentAlConfirmar", () => {
  it("captura un PI en requires_capture con idempotencyKey estable", async () => {
    const stripe = makeStripe({ status: "requires_capture" });
    const result = await capturarPaymentIntentAlConfirmar(
      stripe,
      "pi_test_1",
      { idempotencyKey: "capture-on-confirm:pi_test_1" },
    );

    expect(result.ok).toBe(true);
    expect(result.already_captured).toBeUndefined();
    expect(result.pi_status).toBe("succeeded");
    expect(stripe._mocks.capture).toHaveBeenCalledWith(
      "pi_test_1",
      {},
      { idempotencyKey: "capture-on-confirm:pi_test_1" },
    );
  });

  it("si ya está succeeded, no vuelve a capturar", async () => {
    const stripe = makeStripe({ status: "succeeded" });
    const result = await capturarPaymentIntentAlConfirmar(stripe, "pi_test_1");

    expect(result.ok).toBe(true);
    expect(result.already_captured).toBe(true);
    expect(stripe._mocks.capture).not.toHaveBeenCalled();
  });

  it("si falta paymentIntentId, omite sin error", async () => {
    const stripe = makeStripe();
    const result = await capturarPaymentIntentAlConfirmar(stripe, null);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(stripe._mocks.retrieve).not.toHaveBeenCalled();
  });

  it("si la captura falla, ok=false (el caller debe revertir confirmada)", async () => {
    const stripe = makeStripe({
      status: "requires_capture",
      captureImpl: async () => {
        const err = new Error("card_declined");
        err.code = "card_declined";
        throw err;
      },
    });

    const result = await capturarPaymentIntentAlConfirmar(stripe, "pi_test_1");
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("pi_capture_failed");
    expect(result.error).toMatch(/card_declined/);
  });

  it("carrera: unexpected_state pero PI ya succeeded → ok", async () => {
    const stripe = makeStripe({
      retrieveSequence: [
        { status: "requires_capture" },
        { status: "succeeded" },
      ],
      captureImpl: async () => {
        const err = new Error("This PaymentIntent has already been captured");
        err.code = "payment_intent_unexpected_state";
        throw err;
      },
    });

    const result = await capturarPaymentIntentAlConfirmar(stripe, "pi_test_1");
    expect(result.ok).toBe(true);
    expect(result.already_captured).toBe(true);
  });

  it("rechaza estados no capturables (canceled)", async () => {
    const stripe = makeStripe({ status: "canceled" });
    const result = await capturarPaymentIntentAlConfirmar(stripe, "pi_test_1");
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("pi_not_capturable");
  });
});

describe("liberarPaymentIntentsTrasFalloConfirmacion", () => {
  it("cancela un hold (requires_capture) — cancelación antes de confirmar", async () => {
    const stripe = makeStripe({ status: "requires_capture" });
    const results = await liberarPaymentIntentsTrasFalloConfirmacion(
      stripe,
      ["pi_test_1"],
      { reason: "test-abort" },
    );

    expect(results[0].action).toBe("canceled");
    expect(stripe._mocks.cancel).toHaveBeenCalledWith(
      "pi_test_1",
      {},
      { idempotencyKey: "cancel-pi:test-abort:pi_test_1" },
    );
    expect(stripe._mocks.createRefund).not.toHaveBeenCalled();
  });

  it("reembolsa un PI ya capturado (succeeded) — cancelación después de capturar", async () => {
    const stripe = makeStripe({ status: "succeeded", amount: 5000 });
    const results = await liberarPaymentIntentsTrasFalloConfirmacion(
      stripe,
      ["pi_test_1"],
      { reason: "test-abort" },
    );

    expect(results[0].action).toBe("refunded");
    expect(stripe._mocks.createRefund).toHaveBeenCalledWith(
      { payment_intent: "pi_test_1", amount: 5000 },
      { idempotencyKey: "refund:test-abort:pi_test_1:5000" },
    );
    expect(stripe._mocks.cancel).not.toHaveBeenCalled();
  });
});

describe("completar con PI ya capturado (solo transfer)", () => {
  it("documenta el contrato: capturarYTransferir salta captura si succeeded", async () => {
    // Contrato cubierto en capturar-y-transferir.js (rama piStatus === "succeeded").
    // Aquí verificamos el helper de confirmación deja el PI en succeeded
    // para que el transfer use source_transaction sin re-capturar.
    const stripe = makeStripe({ status: "requires_capture" });
    const result = await capturarPaymentIntentAlConfirmar(stripe, "pi_test_1");
    expect(result.ok).toBe(true);
    expect(result.paymentIntent.status).toBe("succeeded");

    const again = await capturarPaymentIntentAlConfirmar(
      makeStripe({ status: "succeeded" }),
      "pi_test_1",
    );
    expect(again.already_captured).toBe(true);
  });
});
