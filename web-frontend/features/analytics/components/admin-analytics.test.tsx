import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminAnalytics } from "./admin-analytics";
import type { AnalyticsSummary } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const user = { id: "10000000-0000-4000-8000-000000000001", email: "admin@usth.edu.vn", fullName: "Analytics Admin", role: "admin" as const, createdAt: "2099-01-01T00:00:00.000Z" };
const statuses = [
  ["pending", 2, 40], ["confirmed", 1, 20], ["checked_in", 0, 0],
  ["completed", 1, 20], ["no_show", 0, 0], ["rejected", 0, 0], ["cancelled", 1, 20],
].map(([status, count, percentage]) => ({ status, count, percentage })) as AnalyticsSummary["statuses"];
const summary: AnalyticsSummary = {
  from: "2099-03-01", to: "2099-03-31", timeZone: "Asia/Ho_Chi_Minh",
  totalBookings: 5, cancelledBookings: 1, cancellationRate: 20,
  scheduledHours: 8, capacityHours: 100, utilizationRate: 8, resourcesRepresented: 1,
  statuses,
  popularResources: [{ id: "20000000-0000-4000-8000-000000000001", code: "ROOM-A101", name: "Study Room A101", building: "Main Academic Building", bookingCount: 4, bookedHours: 8 }],
  peakHours: [{ hour: 9, label: "09:00", bookingCount: 3 }, { hour: 10, label: "10:00", bookingCount: 2 }],
  definition: "Bookings are grouped by scheduled campus date. Scheduled occupancy excludes cancelled, rejected, and no-show requests.",
};

describe("AdminAnalytics", () => {
  it("renders live metrics, charts, ranking, definitions, and date controls", () => {
    render(<AdminAnalytics user={user} summary={summary} />);
    expect(screen.getByRole("heading", { name: "See where campus time is being reserved" })).toBeInTheDocument();
    const metrics = screen.getByLabelText("Booking analytics summary");
    expect(metrics).toHaveTextContent("5");
    expect(metrics).toHaveTextContent("20.0%");
    expect(metrics).toHaveTextContent("8.0%");
    expect(screen.getByRole("heading", { name: "Booking status breakdown" })).toBeInTheDocument();
    expect(screen.getByText("Qualifying requests touching each hour")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /09:00: 3 bookings/ })).toBeInTheDocument();
    expect(screen.getByText("requested hours")).toBeInTheDocument();
    expect(screen.getByText("Study Room A101")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Metric definitions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
  });

  it("describes excluded-only demand without claiming occupancy", () => {
    render(<AdminAnalytics user={user} summary={{
      ...summary,
      scheduledHours: 0,
      utilizationRate: 0,
      resourcesRepresented: 0,
      statuses: statuses.map((item) => ({
        ...item,
        count: item.status === "cancelled" ? 5 : 0,
        percentage: item.status === "cancelled" ? 100 : 0,
      })),
      cancelledBookings: 5,
      cancellationRate: 100,
      popularResources: [],
      peakHours: [],
    }} />);
    expect(screen.getByText("No qualifying booking demand by hour in this range.")).toBeInTheDocument();
    expect(screen.getByText("No qualifying resource demand in this range.")).toBeInTheDocument();
    expect(screen.queryByText("No scheduled occupancy hours in this range.")).not.toBeInTheDocument();
  });

  it("renders an actionable empty range without pretending data exists", () => {
    render(<AdminAnalytics user={user} summary={{ ...summary, totalBookings: 0, cancelledBookings: 0, cancellationRate: 0, scheduledHours: 0, capacityHours: 0, utilizationRate: null, resourcesRepresented: 0, statuses: statuses.map((item) => ({ ...item, count: 0, percentage: 0 })), popularResources: [], peakHours: [] }} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No bookings fall inside this range" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Most-booked resources" })).not.toBeInTheDocument();
  });

  it("links to staff approvals from the administrator navigation", () => {
    render(<AdminAnalytics user={user} summary={summary} />);
    const nav = screen.getByRole("navigation", { name: "Administrator sections" });
    expect(within(nav).getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/staff");
    expect(within(nav).getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
  });
});
