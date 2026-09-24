import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  assertSessionActive,
  loginRedirectPath,
  SessionExpiredError,
  withSessionRedirect,
} from "./session";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

describe("server session expiry handling", () => {
  it("throws a typed error only for 401 responses", () => {
    expect(() => assertSessionActive({ status: 401 })).toThrow(SessionExpiredError);
    expect(() => assertSessionActive({ status: 403 })).not.toThrow();
    expect(() => assertSessionActive({ status: 200 })).not.toThrow();
  });

  it("builds an encoded login destination that preserves the route and query", () => {
    expect(loginRedirectPath("/staff?pendingPage=2&operationsPage=3")).toBe(
      "/login?next=%2Fstaff%3FpendingPage%3D2%26operationsPage%3D3",
    );
  });

  it.each(["//evil.example", "https://evil.example", "/\\\\evil", "/a\\u0000b"])(
    "falls back to the dashboard for an unsafe destination %s",
    (value) => {
      expect(loginRedirectPath(value)).toBe("/login?next=%2Fdashboard");
    },
  );

  it("redirects to sign in when a loader reports an expired session", async () => {
    await expect(
      withSessionRedirect("/bookings", async () => {
        throw new SessionExpiredError();
      }),
    ).rejects.toThrow("redirect:/login?next=%2Fbookings");
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("passes through results and unrelated failures", async () => {
    await expect(withSessionRedirect("/bookings", async () => 42)).resolves.toBe(42);
    await expect(
      withSessionRedirect("/bookings", async () => {
        throw new Error("The booking service is unavailable.");
      }),
    ).rejects.toThrow("The booking service is unavailable.");
    expect(redirect).not.toHaveBeenCalled();
  });
});
