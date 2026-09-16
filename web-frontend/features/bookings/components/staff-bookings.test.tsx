import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import {
  approveStaffBooking,
  checkOutStaffBooking,
  confirmStaffCheckIn,
  markStaffBookingNoShow,
  rejectStaffBooking,
} from "../api/staff-browser";
import type { StaffBooking, StaffResourceSchedule } from "../types";
import { StaffApprovalQueue, StaffBookingDetail } from "./staff-bookings";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/staff-browser", () => ({
  approveStaffBooking: vi.fn(),
  checkOutStaffBooking: vi.fn(),
  confirmStaffCheckIn: vi.fn(),
  markStaffBookingNoShow: vi.fn(),
  rejectStaffBooking: vi.fn(),
  StaffBookingActionError: class StaffBookingActionError extends Error {},
}));

const mockedApprove = vi.mocked(approveStaffBooking);
const mockedCheckOut = vi.mocked(checkOutStaffBooking);
const mockedConfirmCheckIn = vi.mocked(confirmStaffCheckIn);
const mockedNoShow = vi.mocked(markStaffBookingNoShow);
const mockedReject = vi.mocked(rejectStaffBooking);
const staff: User = {
  id: "30000000-0000-4000-8000-000000000009",
  email: "staff@usth.edu.vn",
  fullName: "Campus Staff",
  role: "staff",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const booking: StaffBooking = {
  id: "40000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "11:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "pending",
  createdAt: "2026-09-15T01:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  checkInRequested: false,
  canConfirmCheckIn: false,
  canCheckOut: false,
  canMarkNoShow: false,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "LAB-L201",
    name: "Teaching Laboratory L201",
    type: "laboratory",
    location: "Second floor",
    buildingCode: "LAB",
    buildingName: "Laboratory Building",
  },
  requester: {
    id: "30000000-0000-4000-8000-000000000001",
    email: "student@usth.edu.vn",
    fullName: "Campus Student",
  },
  reviewer: null,
};
const schedule: StaffResourceSchedule = {
  resourceId: booking.resource.id,
  date: booking.date,
  bookings: [booking],
};

describe("staff approval workflow", () => {
  beforeEach(() => {
    mockedApprove.mockReset();
    mockedCheckOut.mockReset();
    mockedConfirmCheckIn.mockReset();
    mockedNoShow.mockReset();
    mockedReject.mockReset();
    refresh.mockReset();
  });

  it("renders the oldest-first approval queue", () => {
    render(<StaffApprovalQueue user={staff} queue={{ items: [booking], total: 1 }} operations={{ items: [], total: 0 }} />);
    expect(screen.getByRole("heading", { name: "Pending approval queue" })).toBeVisible();
    expect(screen.getByText("Teaching Laboratory L201")).toBeVisible();
    expect(screen.getByText(/Campus Student/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Review request/ })).toHaveAttribute(
      "href",
      `/staff/bookings/${booking.id}`,
    );
  });

  it("renders live staff dashboard summaries", () => {
    const codeReady = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000002",
      status: "confirmed" as const,
      checkInRequested: true,
      canConfirmCheckIn: true,
    };
    const activeVisit = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000003",
      status: "checked_in" as const,
      checkedInAt: "2026-09-16T01:00:00.000Z",
      canCheckOut: true,
    };
    const expiredCode = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000004",
      status: "confirmed" as const,
      checkInRequested: true,
      canMarkNoShow: true,
    };
    render(
      <StaffApprovalQueue
        user={staff}
        queue={{ items: [booking], total: 1 }}
        operations={{ items: [codeReady, activeVisit, expiredCode], total: 3 }}
      />,
    );

    const summary = screen.getByLabelText("Staff dashboard summary");
    expect(summary).toHaveTextContent("1Requests to review");
    expect(summary).toHaveTextContent("3Visits to manage today");
    expect(summary).toHaveTextContent("1Codes ready to verify");
    expect(summary).toHaveTextContent("1Active visits");
    expect(screen.getByText("Ready for no-show review")).toBeVisible();
  });

  it("approves a request and focuses the recorded outcome", async () => {
    mockedApprove.mockResolvedValue({
      ...booking,
      status: "confirmed",
      reviewedAt: "2026-09-16T01:00:00.000Z",
      reviewer: { id: staff.id, email: staff.email, fullName: staff.fullName },
    });
    render(<StaffBookingDetail user={staff} booking={booking} schedule={schedule} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve booking" }));
    expect(mockedApprove).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("The student has not generated a check-in code yet.")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Confirm campus arrival" })).toHaveFocus(),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("confirms check-in and completes checkout", async () => {
    const confirmed: StaffBooking = {
      ...booking,
      status: "confirmed",
      checkInRequested: true,
      canConfirmCheckIn: true,
    };
    const checkedIn: StaffBooking = {
      ...confirmed,
      status: "checked_in",
      canConfirmCheckIn: false,
      canCheckOut: true,
      checkedInAt: "2026-09-16T01:00:00.000Z",
    };
    mockedConfirmCheckIn.mockResolvedValue(checkedIn);
    mockedCheckOut.mockResolvedValue({
      ...checkedIn,
      status: "completed",
      canCheckOut: false,
      checkedOutAt: "2026-09-16T02:00:00.000Z",
    });
    render(<StaffBookingDetail user={staff} booking={confirmed} schedule={{ ...schedule, bookings: [confirmed] }} />);

    await userEvent.type(screen.getByLabelText("Student check-in code"), "482193");
    await userEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    expect(mockedConfirmCheckIn).toHaveBeenCalledWith(booking.id, "482193");
    expect(await screen.findByRole("button", { name: "Confirm check-out" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Confirm check-out" }));
    expect(mockedCheckOut).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("Visit completed")).toBeVisible();
  });

  it("requires and submits a rejection reason", async () => {
    mockedReject.mockResolvedValue({
      ...booking,
      status: "rejected",
      reviewedAt: "2026-09-16T01:00:00.000Z",
      rejectionReason: "Laboratory reserved for teaching.",
      reviewer: { id: staff.id, email: staff.email, fullName: staff.fullName },
    });
    render(<StaffBookingDetail user={staff} booking={booking} schedule={schedule} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject with reason" }));
    expect(screen.getByLabelText("Reason for rejection")).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Reject request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 3 characters");

    await userEvent.type(
      screen.getByLabelText("Reason for rejection"),
      "Laboratory reserved for teaching.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject request" }));
    expect(mockedReject).toHaveBeenCalledWith(
      booking.id,
      "Laboratory reserved for teaching.",
    );
    expect(await screen.findByText("Request rejected")).toBeVisible();
  });
});
