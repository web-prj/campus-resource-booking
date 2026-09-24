import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminResourcesPage from "./page";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminResourceCatalog } from "@/features/resources/api/server";
import { SessionExpiredError } from "@/lib/api/session";
import { redirect } from "next/navigation";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/resources/api/server", () => ({
  getAdminResourceCatalog: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const admin = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Resource Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const catalog = {
  page: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
  buildings: [],
};

function render(searchParams: Record<string, string | string[] | undefined> = {}) {
  return AdminResourcesPage({ searchParams: Promise.resolve(searchParams) });
}

describe("AdminResourcesPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getAdminResourceCatalog).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects an anonymous request to the safe resource-admin login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(render()).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/admin/resources")}`,
    );
    expect(getAdminResourceCatalog).not.toHaveBeenCalled();
  });

  it("redirects a non-admin account before loading administrator data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, role: "student" });

    await expect(render()).rejects.toThrow("redirect:/dashboard");
    expect(getAdminResourceCatalog).not.toHaveBeenCalled();
  });

  it("passes the authenticated administrator and authoritative catalog to the manager", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminResourceCatalog).mockResolvedValue(catalog);

    const page = await render();

    expect(getAdminResourceCatalog).toHaveBeenCalledWith(1);
    expect(page.props).toEqual({ user: admin, ...catalog });
  });

  it("loads the requested catalog page and treats invalid values as page 1", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminResourceCatalog).mockResolvedValue({
      ...catalog,
      page: { ...catalog.page, total: 45, page: 2, totalPages: 3 },
    });

    await render({ page: "2" });
    expect(getAdminResourceCatalog).toHaveBeenLastCalledWith(2);

    await render({ page: "zero" });
    expect(getAdminResourceCatalog).toHaveBeenLastCalledWith(1);
  });

  it("redirects an out-of-range page to the last catalog page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminResourceCatalog).mockResolvedValue({
      ...catalog,
      page: { ...catalog.page, total: 41, page: 7, totalPages: 3 },
    });

    await expect(render({ page: "7" })).rejects.toThrow(
      "redirect:/admin/resources?page=3",
    );
  });

  it("returns an expired session to sign in on the same catalog page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminResourceCatalog).mockRejectedValue(
      new SessionExpiredError(),
    );

    await expect(render({ page: "2" })).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/admin/resources?page=2")}`,
    );
  });
});
