import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createBookingRequest } from "@/features/bookings/api/browser";
import type { Resource, ResourceAvailability } from "../types";
import { ResourceDetail } from "./resource-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/bookings/api/browser", () => ({
  createBookingRequest: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {},
}));

const mockedCreateBooking = vi.mocked(createBookingRequest);

const user = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const resource: Resource = {
  id: "20000000-0000-4000-8000-000000000003",
  code: "LAB-L201",
  name: "Teaching Laboratory L201",
  description: "A supervised laboratory for scheduled practical sessions.",
  type: "laboratory",
  status: "active",
  capacity: 24,
  location: "Second floor",
  amenities: ["workstations", "projector"],
  requiresApproval: true,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building: {
    id: "10000000-0000-4000-8000-000000000002",
    code: "LAB",
    name: "Laboratory Building",
    address: "USTH Campus, Hanoi",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ResourceDetail", () => {
  it("renders location, capacity, amenities, and approval rules", () => {
    render(<ResourceDetail user={user} resource={resource} />);

    expect(
      screen.getByRole("heading", { name: "Teaching Laboratory L201" }),
    ).toBeVisible();
    expect(screen.getByText("24 places")).toBeVisible();
    expect(screen.getByText("Staff approval required")).toBeVisible();
    expect(screen.getByText("workstations")).toBeVisible();
    expect(screen.getByText("projector")).toBeVisible();
    expect(screen.getByText("USTH Campus, Hanoi")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to resource directory" }),
    ).toHaveAttribute("href", "/resources");
  });

  it("prompts for a date and accurately limits operational availability", () => {
    render(<ResourceDetail user={user} resource={resource} />);

    expect(
      screen.getByRole("heading", { name: "Check availability" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByRole("button", { name: "Check date" })).toBeVisible();
    expect(
      screen.getByText(/current pending or confirmed bookings/),
    ).toBeVisible();
    expect(screen.getByText(/Select a slot to review/)).toBeVisible();
  });

  it("renders authoritative hourly slots and a non-reservation selection", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2026-09-15",
      timeZone: "Asia/Ho_Chi_Minh",
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "08:00", endTime: "09:00" },
        { startTime: "09:00", endTime: "10:00" },
      ],
    };

    render(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={{ startTime: "09:00", endTime: "10:00" }}
      />,
    );

    expect(screen.getByText("2 operational hourly slots")).toBeVisible();
    expect(
      screen.getByText(/Pending and confirmed bookings are excluded/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /08:00/ }),
    ).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2026-09-15&startTime=08%3A00&endTime=09%3A00`,
    );
    expect(
      screen.getByRole("link", { name: "09:00 to 10:00" }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByText(/does not reserve or hold/)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Request this resource" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeVisible();
  });

  it("submits a validated multi-hour interval", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
      ],
    };

    render(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={{ startTime: "09:00", endTime: "11:00" }}
      />,
    );

    expect(screen.getByText("09:00–11:00 ICT (UTC+7)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeEnabled();
  });

  it("remounts a dirty date from canonical URL state after slot navigation", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [{ startTime: "09:00", endTime: "10:00" }],
    };
    const view = render(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2099-01-06" },
    });

    view.rerender(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[0]}
      />,
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2099-01-05");
  });

  it("resets booking state when another slot is selected", async () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
      ],
    };
    mockedCreateBooking.mockResolvedValueOnce({
      id: "40000000-0000-4000-8000-000000000001",
      requesterId: user.id,
      resourceId: resource.id,
      date: availability.date,
      startTime: "09:00",
      endTime: "10:00",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "pending",
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    const view = render(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[0]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );
    expect(
      await screen.findByText("Request sent — pending staff approval."),
    ).toBeVisible();

    view.rerender(
      <ResourceDetail
        user={user}
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[1]}
      />,
    );

    expect(screen.getByText("10:00–11:00 ICT (UTC+7)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Request sent — pending staff approval."),
    ).not.toBeInTheDocument();
  });

  it("explains when bookings occupy every operational slot", () => {
    render(
      <ResourceDetail
        user={user}
        resource={resource}
        checkedDate="2099-01-05"
        availability={{
          resourceId: resource.id,
          date: "2099-01-05",
          timeZone: "Asia/Ho_Chi_Minh",
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: null,
          closureReason: null,
          requiresApproval: true,
          slots: [],
        }}
      />,
    );

    expect(screen.getByText("No bookable hourly slots remain")).toBeVisible();
    expect(
      screen.getByText(/has elapsed or is occupied/),
    ).toBeVisible();
    expect(screen.queryByLabelText("Available time slots")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("renders closure reasons without fabricating slots", () => {
    render(
      <ResourceDetail
        user={user}
        resource={resource}
        checkedDate="2026-09-18"
        availability={{
          resourceId: resource.id,
          date: "2026-09-18",
          timeZone: "Asia/Ho_Chi_Minh",
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: "closure",
          closureReason: "Campus maintenance",
          requiresApproval: true,
          slots: [],
        }}
      />,
    );

    expect(screen.getByText("No operational availability")).toBeVisible();
    expect(screen.getByText("Closure reason: Campus maintenance")).toBeVisible();
    expect(screen.queryByLabelText("Available time slots")).not.toBeInTheDocument();
  });

  it("shows approval policy and a useful amenities fallback", () => {
    render(
      <ResourceDetail
        user={user}
        resource={{
          ...resource,
          id: "20000000-0000-4000-8000-000000000004",
          type: "equipment",
          name: "Portable Projector 01",
          capacity: 1,
          description: null,
          amenities: [],
          requiresApproval: false,
        }}
      />,
    );

    expect(screen.getByText("1 place")).toBeVisible();
    expect(screen.getByText("No staff approval required")).toBeVisible();
    expect(
      screen.getByText(/No additional description has been provided/),
    ).toBeVisible();
    expect(
      screen.getByText(/No additional amenities are listed/),
    ).toBeVisible();
  });
});
