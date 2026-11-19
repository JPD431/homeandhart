import { describe, expect, it } from "vitest";
import { isValidBookingUuid } from "@/app/lib/reviews";

describe("isValidBookingUuid", () => {
  it("acepta UUIDs válidos", () => {
    expect(
      isValidBookingUuid("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
    expect(
      isValidBookingUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
    ).toBe(true);
  });

  it("rechaza IDs inválidos o vacíos", () => {
    expect(isValidBookingUuid("")).toBe(false);
    expect(isValidBookingUuid(null)).toBe(false);
    expect(isValidBookingUuid("no-es-uuid")).toBe(false);
    expect(isValidBookingUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });
});
