import { render, screen, waitFor, within } from "@testing-library/react";
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
import type {
  StaffBooking,
  StaffBookingQueue,
  StaffOperationsQueue,
  StaffResourceSchedule,
} from "../types";
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
function queueOf(
  items: StaffBooking[],
  overrides: Partial<StaffBookingQueue> = {},
): StaffBookingQueue {
  const total = overrides.total ?? items.length;
  return {
    items,
    total,
    page: 1,
    pageSize: 20,
    totalPages: Math.ceil(total / 20),
    ...overrides,
  };
}

function operationsOf(
  items: StaffBooking[],
  overrides: Partial<StaffOperationsQueue> = {},
): StaffOperationsQueue {
  return { ...queueOf(items, overrides), campusDate: "2099-01-05", ...overrides };
}

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
    render(<StaffApprovalQueue user={staff} queue={queueOf([booking])} operations={operationsOf([])} />);
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
        queue={queueOf([booking])}
        operations={operationsOf([previousDate, codeReady, activeVisit, expiredCode])}
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

  it("paginates each queue independently and reports totals across all pages", () => {
    const second = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000010",
      createdAt: "2026-09-15T02:00:00.000Z",
    };
    const visit = {
      ...booking,
      id: "40000000-0000-4000-8000-000000000011",
      status: "confirmed" as const,
      canReview: false,
    };
    render(
      <StaffApprovalQueue
        user={staff}
        queue={queueOf([booking, second], { total: 42, page: 2, totalPages: 3 })}
        operations={operationsOf([visit], { total: 21, page: 2, totalPages: 2 })}
      />,
    );

    const summary = screen.getByLabelText("Staff dashboard summary");
    expect(summary).toHaveTextContent("42Requests to review");
    expect(summary).toHaveTextContent("21Open visits to manage");
    expect(summary).toHaveTextContent("Codes ready on this page");
    expect(summary).toHaveTextContent("Oldest request on this page");
    expect(screen.getByLabelText("42 pending requests")).toBeVisible();
    expect(screen.getByLabelText("Queue position 21")).toBeVisible();

    const pending = screen.getByRole("navigation", {
      name: "Pending approval queue pages",
    });
    expect(pending).toHaveTextContent("Page 2 of 3");
    expect(within(pending).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/staff?operationsPage=2",
    );
    expect(within(pending).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/staff?pendingPage=3&operationsPage=2",
    );

    const visits = screen.getByRole("navigation", {
      name: "Operational worklist pages",
    });
    expect(visits).toHaveTextContent("Page 2 of 2");
    expect(within(visits).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/staff?pendingPage=2",
    );
    expect(within(visits).queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
    expect(within(visits).getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  it("hides pagination when each queue fits on one page", () => {
    render(<StaffApprovalQueue user={staff} queue={queueOf([booking])} operations={operationsOf([])} />);
    expect(screen.queryByRole("navigation", { name: /pages$/ })).not.toBeInTheDocument();
  });

  it("shows administrator sections alongside staff tools for admins", () => {
    const admin: User = { ...staff, role: "admin", fullName: "Campus Admin" };
    render(<StaffApprovalQueue user={admin} queue={queueOf([booking])} operations={operationsOf([])} />);

    const nav = screen.getByRole("navigation", { name: "Staff navigation" });
    expect(within(nav).getByRole("link", { name: "Approval queue" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/admin/resources");
    expect(within(nav).getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    expect(within(nav).getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/admin/analytics");
    expect(within(nav).getByRole("link", { name: "Resources" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Administrator")).toBeVisible();
  });

  it("keeps staff navigation limited to staff tools", () => {
    render(<StaffBookingDetail user={staff} booking={booking} schedule={schedule} />);
    const nav = screen.getByRole("navigation", { name: "Staff navigation" });
    expect(within(nav).queryByRole("link", { name: "Resources" })).not.toBeInTheDocument();
    expect(within(nav).getByText("Request detail")).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Approval queue" })).not.toHaveAttribute("aria-current");
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

    expect(screen.getByRole("heading", { name: "Review window ended" })).toBeVisible();
    expect(screen.getByText("Expired request · not reviewed in time")).toBeVisible();
    expect(screen.getByText("Expired request")).toBeVisible();
    expect(
      screen.getByText(/review window has closed and it can no longer be reviewed/),
    ).toBeVisible();
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
