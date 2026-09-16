import { describe, expect, it } from "vitest";
import { parseAnalyticsSummary } from "./schema";

const statuses = ["pending", "confirmed", "checked_in", "completed", "no_show", "rejected", "cancelled"].map((status, index) => ({ status, count: index === 0 ? 2 : 0, percentage: index === 0 ? 100 : 0 }));

const summary = {
  from: "2099-03-01", to: "2099-03-31", timeZone: "Asia/Ho_Chi_Minh",
  totalBookings: 2, cancelledBookings: 0, cancellationRate: 0,
  scheduledHours: 4, capacityHours: 100, utilizationRate: 4,
  resourcesRepresented: 1, statuses,
  popularResources: [{ id: "20000000-0000-4000-8000-000000000001", code: "A101", name: "Room A101", building: "Main", bookingCount: 2, bookedHours: 4 }],
  peakHours: [{ hour: 9, label: "09:00", bookingCount: 2 }],
  definition: "Bookings are grouped by scheduled campus date with documented utilization rules.",
};

describe("parseAnalyticsSummary", () => {
  it("accepts a complete authoritative analytics response", () => {
    expect(parseAnalyticsSummary(summary)).toEqual(summary);
  });

  it("accepts zero capacity only with zero scheduled hours and unavailable utilization", () => {
    expect(parseAnalyticsSummary({
      ...summary,
      scheduledHours: 0,
      capacityHours: 0,
      utilizationRate: null,
    })).not.toBeNull();
  });

  it.each([
    { ...summary, timeZone: "UTC" },
    { ...summary, scheduledHours: 1, capacityHours: 0, utilizationRate: null },
    { ...summary, cancellationRate: 1 },
    { ...summary, utilizationRate: 5 },
    { ...summary, from: "2099-02-30" },
    { ...summary, statuses: statuses.slice(1) },
    { ...summary, totalBookings: 3 },
    { ...summary, peakHours: [{ hour: 9, label: "10:00", bookingCount: 2 }] },
    { ...summary, popularResources: [{ ...summary.popularResources[0], id: "not-a-uuid" }] },
    { ...summary, resourcesRepresented: 2, popularResources: [{ ...summary.popularResources[0], bookingCount: 1 }, { ...summary.popularResources[0], id: "20000000-0000-4000-8000-000000000002", bookingCount: 2 }] },
  ])("rejects inconsistent or malformed analytics", (value) => {
    expect(parseAnalyticsSummary(value)).toBeNull();
  });
});
