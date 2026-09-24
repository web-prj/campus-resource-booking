import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ toString: (): string => "access_token=test" })),
}));

import { getAdminUsers } from "./server";
import { SessionExpiredError } from "@/lib/api/session";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "staff",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("admin user server API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("INTERNAL_API_URL", "http://backend:18320/api");
  });

  it("sends scoped filters without caching", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ items: [user], total: 1, page: 2, pageSize: 20, totalPages: 1 }));
    await expect(getAdminUsers({ q: "Nam", role: "staff", status: "active", page: 2 }, request)).rejects.toThrow("invalid directory data");
    expect(request).toHaveBeenCalledWith(
      "http://backend:18320/api/admin/users?page=2&pageSize=20&q=Nam&role=staff&isActive=true",
      expect.objectContaining({ cache: "no-store", headers: { Cookie: "access_token=test" } }),
    );
  });

  it("accepts an empty out-of-range page for route canonicalization", async () => {
    const page = {
      items: [],
      total: 1,
      page: 99,
      pageSize: 20,
      totalPages: 1,
    };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(page));

    await expect(getAdminUsers({ page: 99 }, request)).resolves.toEqual(page);
  });

  it("accepts matching pagination metadata", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ items: [user], total: 1, page: 1, pageSize: 20, totalPages: 1 }));
    await expect(getAdminUsers({ page: 1 }, request)).resolves.toMatchObject({ items: [user], total: 1 });
  });

  it("signals an expired session instead of a generic failure", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(getAdminUsers({ page: 1 }, request)).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
