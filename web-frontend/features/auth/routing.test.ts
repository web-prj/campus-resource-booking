import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "./routing";

describe("getSafeRedirect", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/welcome", "/welcome"],
    ["/bookings?status=pending", "/bookings?status=pending"],
    ["  /dashboard  ", "/dashboard"],
  ])("accepts internal path %j", (value, expected) => {
    expect(getSafeRedirect(value)).toBe(expected);
  });

  it.each([
    undefined,
    ["/welcome"],
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/welcome\u0000",
  ])("rejects unsafe redirect %j", (value) => {
    expect(getSafeRedirect(value)).toBe("/dashboard");
  });

  it("uses the supplied fallback", () => {
    expect(getSafeRedirect("https://evil.example", "/login")).toBe("/login");
  });
});
