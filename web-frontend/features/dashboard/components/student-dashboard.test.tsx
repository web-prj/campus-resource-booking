import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import type { StudentBookingTimeline } from "@/features/bookings/types";
import type { Resource, ResourceAvailability } from "@/features/resources/types";
import {
  type DashboardResource,
  StudentDashboard,
} from "./student-dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const user: User = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const resource: Resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: null,
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "20:00",
  building: {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MAIN",
    name: "Main Academic Building",
    address: "USTH Campus, Hanoi",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const availability: ResourceAvailability = {
  resourceId: resource.id,
  date: "2099-01-05",
  timeZone: "Asia/Ho_Chi_Minh",
  opensAt: "08:00",
  closesAt: "20:00",
  blockedReason: null,
  closureReason: null,
  requiresApproval: false,
  slots: [
    { startTime: "08:00", endTime: "09:00" },
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "11:00" },
  ],
};

const dashboardResources: DashboardResource[] = [{ resource, availability }];

const timeline: StudentBookingTimeline = {
  upcoming: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      date: "2099-01-05",
      startTime: "10:00",
      endTime: "11:00",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      canCancel: true,
      canRequestCheckIn: false,
      checkInCode: null,
      checkInRequestedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      noShowAt: null,
      cancelledAt: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      resource: {
        id: resource.id,
        code: resource.code,
        name: resource.name,
        type: resource.type,
        location: resource.location,
        buildingCode: resource.building.code,
        buildingName: resource.building.name,
      },
    },
  ],
  history: [],
};

describe("student live dashboard", () => {
  it("renders authoritative resource, availability, and next-booking data", () => {
    render(
      <StudentDashboard
        user={user}
        timeline={timeline}
        resources={dashboardResources}
        totalResources={4}
        campusDate="2099-01-05"
      />,
    );

    expect(screen.getByText("1 shown · 4 active resources")).toBeVisible();
    expect(screen.getAllByText("Study Room A101")).toHaveLength(3);
    expect(
      screen.getByRole("img", {
        name: "Study Room A101, 08:00 to 10:00, open",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Study Room A101, 10:00 to 12:00, partly open",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Study Room A101, 12:00 to 14:00, unavailable",
      }),
    ).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
    expect(screen.getByRole("link", { name: /Open booking/ })).toHaveAttribute(
      "href",
      `/bookings/${timeline.upcoming[0].id}`,
    );
    expect(screen.queryByText("Interface preview")).not.toBeInTheDocument();
  });

  it("gives useful empty states without claiming live inventory", () => {
    render(
      <StudentDashboard
        user={user}
        timeline={{ upcoming: [], history: [] }}
        resources={[]}
        totalResources={0}
        campusDate="2099-01-05"
      />,
    );

    expect(screen.getByText("No resources are available to compare.")).toBeVisible();
    expect(screen.getByText("No active reservations")).toBeVisible();
    expect(screen.getByText("No active resources are listed right now.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Find a resource/ })).toHaveAttribute(
      "href",
      "/resources",
    );
  });
});
