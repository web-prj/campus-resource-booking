import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserRole, updateUserStatus } from "./browser";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "student",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin user browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("updates a role with credentialed strict response validation", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...user, role: "staff" }));
    await expect(updateUserRole(user.id, "staff", request)).resolves.toMatchObject({ role: "staff" });
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/admin/users/${user.id}/role`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ role: "staff" }),
      }),
    );
  });

  it("updates account access", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...user, isActive: false }));
    await expect(updateUserStatus(user.id, false, request)).resolves.toMatchObject({ isActive: false });
  });

  it.each([[400, "validation"], [401, "session"], [403, "forbidden"], [404, "not-found"]] as const)(
    "maps HTTP %i to %s",
    async (status, code) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));
      await expect(updateUserRole(user.id, "staff", request)).rejects.toMatchObject({ code });
    },
  );

  it("rejects a successful response for a different account", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...user, id: "22222222-2222-4222-8222-222222222222", role: "staff" }));
    await expect(updateUserRole(user.id, "staff", request)).rejects.toMatchObject({ code: "unexpected" });
  });
});
