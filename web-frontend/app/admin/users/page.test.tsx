import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "@/lib/api/session";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminUsers } from "@/features/users/api/server";
import { redirect } from "next/navigation";
import AdminUsersPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/users/api/server", () => ({ getAdminUsers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const admin = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Campus Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function directory(page = 1, totalPages = 1) {
  return {
    items: [],
    total: totalPages,
    page,
    pageSize: 20,
    totalPages,
  };
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getAdminUsers).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects anonymous visitors before loading account data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(
      AdminUsersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(`redirect:/login?next=${encodeURIComponent("/admin/users")}`);
    expect(getAdminUsers).not.toHaveBeenCalled();
  });

  it("keeps the requested filters in the login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(
      AdminUsersPage({
        searchParams: Promise.resolve({ role: "staff", page: "2" }),
      }),
    ).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/admin/users?role=staff&page=2")}`,
    );
  });

  it("redirects non-admin accounts before loading account data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, role: "staff" });

    await expect(
      AdminUsersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/dashboard");
    expect(getAdminUsers).not.toHaveBeenCalled();
  });

  it("normalizes supported filters and ignores unknown values", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminUsers).mockResolvedValue(directory());

    const page = await AdminUsersPage({
      searchParams: Promise.resolve({
        q: "  campus staff  ",
        role: "staff",
        status: "active",
        page: "2.5",
        unknown: "ignored",
      }),
    });

    const filters = {
      q: "campus staff",
      role: "staff" as const,
      status: "active" as const,
      page: 1,
    };
    expect(getAdminUsers).toHaveBeenCalledWith(filters);
    expect(page.props).toEqual({
      currentUser: admin,
      directory: directory(),
      filters,
    });
  });

  it("redirects an out-of-range page while preserving filters", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminUsers).mockResolvedValue(directory(99, 2));

    await expect(
      AdminUsersPage({
        searchParams: Promise.resolve({
          q: "lab user",
          role: "student",
          status: "inactive",
          page: "99",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/admin/users?q=lab+user&role=student&status=inactive&page=2",
    );
  });

  it("returns an expired session to sign in with the directory filters", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminUsers).mockRejectedValue(new SessionExpiredError());
    await expect(
      AdminUsersPage({ searchParams: Promise.resolve({ role: "staff", page: "2" }) }),
    ).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/admin/users?role=staff&page=2")}`,
    );
  });
});
