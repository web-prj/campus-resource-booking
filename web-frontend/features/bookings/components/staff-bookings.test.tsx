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
  StaffBookingActionError,
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
  StaffBookingActionError: class StaffBookingActionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
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
  canReview: true,
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
    render(<StaffApprovalQueue user={staff} queue={{ items: [booking], total: 1 }} operations={{ items: [], total: 0, campusDate: "2099-01-05" }} />);
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
      canReview: false,
      checkInRequested: true,
      canConfirmCheckIn: true,
    };
    const activeVisit = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000003",
      status: "checked_in" as const,
      canReview: false,
      checkedInAt: "2026-09-16T01:00:00.000Z",
      canCheckOut: true,
    };
    const expiredCode = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000004",
      status: "confirmed" as const,
      canReview: false,
      checkInRequested: true,
      canMarkNoShow: true,
    };
    const previousDate = {
      ...expiredCode,
      id: "40000000-0000-4000-8000-000000000005",
      date: "2099-01-04",
    };
    render(
      <StaffApprovalQueue
        user={staff}
        queue={{ items: [booking], total: 1 }}
        operations={{
          items: [previousDate, codeReady, activeVisit, expiredCode],
          total: 4,
          campusDate: "2099-01-05",
        }}
      />,
    );

    const summary = screen.getByLabelText("Staff dashboard summary");
    expect(summary).toHaveTextContent("1Requests to review");
    expect(summary).toHaveTextContent("4Open visits to manage");
    expect(summary).toHaveTextContent("1Codes ready to verify");
    expect(summary).toHaveTextContent("1Active visits");
    expect(screen.getAllByText("Ready for no-show review")).toHaveLength(2);
    expect(screen.getByText(/Overdue · 4 Jan · 09:00–11:00 ICT/)).toBeVisible();
  });

  it("approves a request and focuses the recorded outcome", async () => {
    mockedApprove.mockResolvedValue({
      ...booking,
      status: "confirmed",
      canReview: false,
      reviewedAt: "2026-09-16T01:00:00.000Z",
      reviewer: { id: staff.id, email: staff.email, fullName: staff.fullName },
    });
    render(<StaffBookingDetail user={staff} booking={booking} schedule={schedule} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve booking" }));
    expect(mockedApprove).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("The student has not generated a check-in code yet.")).toBeVisible();
    expect(screen.getAllByText("Confirmed")).toHaveLength(2);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Confirm campus arrival" })).toHaveFocus(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows elapsed pending requests as read-only", () => {
    render(
      <StaffBookingDetail
        user={staff}
        booking={{ ...booking, canReview: false }}
        schedule={schedule}
      />,
    );

    expect(screen.getByRole("heading", { name: "Approval window ended" })).toBeVisible();
    expect(screen.getByText("Request remains pending")).toBeVisible();
    expect(
      screen.getByText("No active bookings remain for this resource on this date."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject with reason" })).not.toBeInTheDocument();
  });

  it("focuses review conflicts and offers an authoritative refresh", async () => {
    mockedApprove.mockRejectedValue(
      new StaffBookingActionError(
        "conflict",
        "This request is no longer eligible for review. Refresh its details.",
      ),
    );
    render(<StaffBookingDetail user={staff} booking={booking} schedule={schedule} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve booking" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(
      screen.getByRole("button", { name: "Refresh booking details" }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh booking details" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("confirms check-in and completes checkout", async () => {
    const confirmed: StaffBooking = {
      ...booking,
      status: "confirmed",
      canReview: false,
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

  it("validates code input, focuses lifecycle errors, and offers recovery", async () => {
    const confirmed: StaffBooking = {
      ...booking,
      status: "confirmed",
      canReview: false,
      checkInRequested: true,
      canConfirmCheckIn: true,
    };
    mockedConfirmCheckIn.mockRejectedValue(
      new StaffBookingActionError(
        "conflict",
        "This visit is no longer eligible for that update. Refresh its details.",
      ),
    );
    render(
      <StaffBookingDetail
        user={staff}
        booking={confirmed}
        schedule={{ ...schedule, bookings: [confirmed] }}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm check-in" }),
    );
    let alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("six-digit code");
    expect(mockedConfirmCheckIn).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Student check-in code"), "482193");
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm check-in" }),
    );
    alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh booking details" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("records a no-show and removes the released interval", async () => {
    const ended: StaffBooking = {
      ...booking,
      status: "confirmed",
      canReview: false,
      canMarkNoShow: true,
    };
    mockedNoShow.mockResolvedValue({
      ...ended,
      status: "no_show",
      canMarkNoShow: false,
      noShowAt: "2099-01-05T04:00:00.000Z",
    });
    render(
      <StaffBookingDetail
        user={staff}
        booking={ended}
        schedule={{ ...schedule, bookings: [ended] }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Mark as no-show" }));

    expect(mockedNoShow).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("No-show recorded")).toBeVisible();
    expect(
      screen.getByText("No active bookings remain for this resource on this date."),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No-show by staff" })).toHaveFocus(),
    );
  });

  it("requires and submits a rejection reason", async () => {
    mockedReject.mockResolvedValue({
      ...booking,
      status: "rejected",
      canReview: false,
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
    expect(
      screen.getByText("No active bookings remain for this resource on this date."),
    ).toBeVisible();
  });
});
