import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, LoginError, logout } from "./browser";

const validUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function response(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("auth browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api/");
  });

  it("normalizes login input and includes cookie credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(validUser));

    await expect(
      login({ email: "  NAM.TRAN@USTH.EDU.VN ", password: "secret" }, request),
    ).resolves.toEqual(validUser);

    expect(request).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "nam.tran@usth.edu.vn",
          password: "secret",
        }),
      }),
    );
  });

  it.each([
    [400, "validation"],
    [401, "credentials"],
    [429, "rate-limit"],
    [500, "unexpected"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));

    await expect(
      login({ email: "nam.tran@usth.edu.vn", password: "secret" }, request),
    ).rejects.toMatchObject({ name: "LoginError", code });
  });

  it("maps fetch rejection to a network error", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));

    await expect(
      login({ email: "nam.tran@usth.edu.vn", password: "secret" }, request),
    ).rejects.toMatchObject({ code: "network" } satisfies Partial<LoginError>);
  });

  it("rejects a malformed successful response", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ role: "student" }));

    await expect(
      login({ email: "nam.tran@usth.edu.vn", password: "secret" }, request),
    ).rejects.toMatchObject({ code: "unexpected" });
  });

  it("logs out with a credentialed POST", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(undefined, 204));

    await logout(request);

    expect(request).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
