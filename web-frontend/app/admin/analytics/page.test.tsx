import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "@/lib/api/session";
import AdminAnalyticsPage from "./page";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminAnalytics } from "@/features/analytics/api/server";
import { redirect } from "next/navigation";
import type { AnalyticsSummary } from "@/features/analytics/types";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/analytics/api/server", () => ({ getAdminAnalytics: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

const admin = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Route Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const summary: AnalyticsSummary = {
  from: "2099-01-01", to: "2099-01-30", timeZone: "Asia/Ho_Chi_Minh" as const,
  totalBookings: 0, cancelledBookings: 0, cancellationRate: 0,
  scheduledHours: 0, capacityHours: 0, utilizationRate: null,
  resourcesRepresented: 0,
  statuses: [
    "pending", "confirmed", "checked_in", "completed", "no_show", "rejected", "cancelled",
  ].map((status) => ({ status, count: 0, percentage: 0 })) as AnalyticsSummary["statuses"],
  popularResources: [], peakHours: [],
  definition: "Bookings use campus dates and documented scheduled-utilization rules for this report.",
};

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getAdminAnalytics).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects an anonymous request to the safe analytics login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(AdminAnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(`redirect:/login?next=${encodeURIComponent("/admin/analytics")}`);
    expect(getAdminAnalytics).not.toHaveBeenCalled();
  });

  it("redirects a non-admin account to its role workspace", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, role: "student" });
    await expect(AdminAnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/dashboard");
    expect(getAdminAnalytics).not.toHaveBeenCalled();
  });

  it("passes a valid requested range to the no-store analytics client", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminAnalytics).mockResolvedValue(summary);
    const page = await AdminAnalyticsPage({
      searchParams: Promise.resolve({ from: summary.from, to: summary.to }),
    });
    expect(getAdminAnalytics).toHaveBeenCalledWith({ from: summary.from, to: summary.to });
    expect(page.props.summary).toEqual(summary);
    expect(page.props.user).toEqual(admin);
  });

  it("redirects incomplete, repeated, impossible, or overlong ranges to the canonical default", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    for (const searchParams of [
      { from: "2099-01-01" },
      { from: ["2099-01-01", "2099-01-02"], to: "2099-01-30" },
      { from: "2099-02-30", to: "2101-01-01" },
      { from: "2100-01-01", to: "2099-01-01" },
    ]) {
      await expect(
        AdminAnalyticsPage({ searchParams: Promise.resolve(searchParams) }),
      ).rejects.toThrow("redirect:/admin/analytics");
    }
    expect(getAdminAnalytics).not.toHaveBeenCalled();
  });

  it("returns an expired session to sign in with the requested range", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getAdminAnalytics).mockRejectedValue(new SessionExpiredError());
    await expect(
      AdminAnalyticsPage({
        searchParams: Promise.resolve({ from: "2026-09-01", to: "2026-09-10" }),
      }),
    ).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/admin/analytics?from=2026-09-01&to=2026-09-10")}`,
    );
  });
});
