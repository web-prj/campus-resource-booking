import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "./routing";

describe("getSafeRedirect", () => {
  it.each([
    ["/welcome", "/welcome"],
    ["/bookings?status=pending", "/bookings?status=pending"],
    ["  /welcome  ", "/welcome"],
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
    expect(getSafeRedirect(value)).toBe("/welcome");
  });

  it("uses the supplied fallback", () => {
    expect(getSafeRedirect("https://evil.example", "/login")).toBe("/login");
  });
});
