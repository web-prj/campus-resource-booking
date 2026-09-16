import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getAdminAnalytics } from "./server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const statuses = ["pending", "confirmed", "checked_in", "completed", "no_show", "rejected", "cancelled"].map((status, index) => ({ status, count: index === 0 ? 1 : 0, percentage: index === 0 ? 100 : 0 }));
const summary = {
  from: "2099-03-01", to: "2099-03-31", timeZone: "Asia/Ho_Chi_Minh",
  totalBookings: 1, cancelledBookings: 0, cancellationRate: 0, scheduledHours: 2,
  capacityHours: 100, utilizationRate: 2, resourcesRepresented: 1, statuses,
  popularResources: [{ id: "20000000-0000-4000-8000-000000000001", code: "A101", name: "Room A101", building: "Main", bookingCount: 1, bookedHours: 2 }],
  peakHours: [{ hour: 9, label: "09:00", bookingCount: 1 }],
  definition: "Bookings are grouped by scheduled campus date with documented utilization rules.",
};

describe("getAdminAnalytics", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({ toString: () => "access_token=session" } as never);
  });

  it("fetches uncached, credentialed analytics for the exact date range", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(summary), { status: 200 }));
    await expect(getAdminAnalytics({ from: summary.from, to: summary.to }, request)).resolves.toEqual(summary);
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/admin/analytics?from=${summary.from}&to=${summary.to}`,
      { headers: { Cookie: "access_token=session" }, cache: "no-store" },
    );
  });

  it("rejects malformed analytics data", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...summary, totalBookings: 9 }), { status: 200 }));
    await expect(getAdminAnalytics({ from: summary.from, to: summary.to }, request)).rejects.toThrow("invalid summary data");
  });
});
