import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openStripeDashboard,
  startStripeConnectOnboarding,
} from "@/app/lib/stripe-connect-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openStripeDashboard", () => {
  it("devuelve la url del login-link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ url: "https://connect.stripe.com/express/test" }),
      })),
    );

    const result = await openStripeDashboard();
    expect(result).toEqual({
      ok: true,
      url: "https://connect.stripe.com/express/test",
    });
    expect(fetch).toHaveBeenCalledWith("/api/stripe/connect/login-link", {
      method: "POST",
    });
  });

  it("propaga el error de la API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: "No tienes una cuenta de cobros configurada.",
        }),
      })),
    );

    const result = await openStripeDashboard();
    expect(result).toEqual({
      ok: false,
      error: "No tienes una cuenta de cobros configurada.",
    });
  });
});

describe("startStripeConnectOnboarding", () => {
  it("sigue apuntando a create-account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ url: "https://connect.stripe.com/setup/test" }),
      })),
    );

    const result = await startStripeConnectOnboarding();
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/stripe/connect/create-account", {
      method: "POST",
    });
  });
});
