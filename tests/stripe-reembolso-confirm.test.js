import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/stripe-descuadre-alert", () => ({
  alertStripeDescuadre: vi.fn(async () => {}),
}));

const { aplicarReembolsoStripeBooking } = await import(
  "@/app/lib/stripe-reembolso"
);

function makeStripeForReembolso({ status, amount = 11400, amountRefunded = 0 }) {
  const paymentIntent = {
    id: "pi_reemb_1",
    status,
    amount,
    latest_charge:
      status === "succeeded"
        ? { id: "ch_1", amount_refunded: amountRefunded }
        : null,
  };

  return {
    paymentIntents: {
      retrieve: vi.fn(async () => paymentIntent),
      cancel: vi.fn(async () => ({ ...paymentIntent, status: "canceled" })),
      capture: vi.fn(async () => ({ ...paymentIntent, status: "succeeded" })),
    },
    refunds: {
      create: vi.fn(async () => ({ id: "re_1", amount: Math.round(50 * 100) })),
    },
    charges: {
      retrieve: vi.fn(async () => ({
        id: "ch_1",
        amount_refunded: amountRefunded,
      })),
    },
  };
}

describe("aplicarReembolsoStripeBooking tras cobro-al-confirmar", () => {
  it("antes de confirmar (requires_capture): cancela el hold", async () => {
    const stripe = makeStripeForReembolso({ status: "requires_capture" });
    const result = await aplicarReembolsoStripeBooking(
      stripe,
      "pi_reemb_1",
      114, // reembolso total €
      {
        idempotencyKey: "cancel-pi:test:booking1",
        sharedActiveOthers: 0,
      },
    );

    expect(result.stripe_ok).toBe(true);
    expect(result.stripe_action).toBe("cancel");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("después de capturar (succeeded): hace refund", async () => {
    const stripe = makeStripeForReembolso({ status: "succeeded" });
    const result = await aplicarReembolsoStripeBooking(
      stripe,
      "pi_reemb_1",
      50,
      {
        idempotencyKey: "refund:test:booking1",
        sharedActiveOthers: 0,
      },
    );

    expect(result.stripe_ok).toBe(true);
    expect(result.stripe_action).toBe("refund");
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_reemb_1", amount: 5000 },
      { idempotencyKey: "refund:test:booking1" },
    );
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });
});
