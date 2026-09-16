import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminResourcesPage from "./page";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminResourceCatalog } from "@/features/resources/api/server";
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
const catalog = { resources: [], buildings: [] };

describe("AdminResourcesPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getAdminResourceCatalog).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects an anonymous request to the safe resource-admin login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(AdminResourcesPage()).rejects.toThrow(
      "redirect:/login?next=/admin/resources",
    );
    expect(getAdminResourceCatalog).not.toHaveBeenCalled();
  });

  it("redirects a non-admin account before loading administrator data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, role: "student" });

    await expect(AdminResourcesPage()).rejects.toThrow("redirect:/dashboard");
    expect(getAdminResourceCatalog).not.toHaveBeenCalled();
  });

  it("passes the authenticated administrator and authoritative catalog to the manager", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminResourceCatalog).mockResolvedValue(catalog);

    const page = await AdminResourcesPage();

    expect(getAdminResourceCatalog).toHaveBeenCalledOnce();
    expect(page.props).toEqual({ user: admin, ...catalog });
  });
});
