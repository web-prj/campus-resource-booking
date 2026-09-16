import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import { cancelStudentBooking, requestStudentCheckIn } from "../api/browser";
import type { StudentBooking, StudentBookingTimeline } from "../types";
import { StudentBookingDetail, StudentBookings } from "./student-bookings";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/browser", () => ({
  cancelStudentBooking: vi.fn(),
  requestStudentCheckIn: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {},
}));

const mockedCancel = vi.mocked(cancelStudentBooking);
const mockedCheckIn = vi.mocked(requestStudentCheckIn);
const user: User = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const booking: StudentBooking = {
  id: "40000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
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
  createdAt: "2026-09-15T01:00:00.000Z",
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room",
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

describe("student booking management", () => {
  beforeEach(() => {
    mockedCancel.mockReset();
    mockedCheckIn.mockReset();
    refresh.mockReset();
  });

  it("separates upcoming, pending, and historical status clearly", () => {
    const timeline: StudentBookingTimeline = {
      upcoming: [booking, { ...booking, id: "40000000-0000-4000-8000-000000000002", status: "pending" }],
      history: [{
        ...booking,
        id: "40000000-0000-4000-8000-000000000003",
        status: "cancelled",
        canCancel: false,
        cancelledAt: "2026-09-16T01:00:00.000Z",
      }],
    };
    render(<StudentBookings user={user} timeline={timeline} />);

    expect(screen.getByRole("heading", { name: "Upcoming and pending" })).toBeVisible();
    expect(screen.getByText("Confirmed upcoming").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("Awaiting approval").previousSibling).toHaveTextContent("1");
    expect(screen.getAllByText("Pending approval")).toHaveLength(1);
    expect(screen.getAllByText("Cancelled")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /View details/ })).toHaveLength(3);
  });

  it("generates and presents a student check-in code", async () => {
    mockedCheckIn.mockResolvedValue({
      ...booking,
      canCancel: false,
      canRequestCheckIn: false,
      checkInCode: "482193",
      checkInRequestedAt: "2026-09-16T01:00:00.000Z",
    });
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, canCancel: false, canRequestCheckIn: true }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Generate check-in code" }));
    expect(mockedCheckIn).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("482193")).toBeVisible();
    expect(screen.getByRole("status", { name: "Check-in code 482193" })).toBeVisible();
  });

  it("requires confirmation and reflects a successful cancellation", async () => {
    const cancelled: StudentBooking = {
      ...booking,
      status: "cancelled",
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    mockedCancel.mockResolvedValue(cancelled);
    render(<StudentBookingDetail user={user} booking={booking} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByText("Release this time slot?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep booking" })).toHaveFocus();
    expect(mockedCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(mockedCancel).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("This booking was cancelled")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "This booking was cancelled" })).toHaveFocus(),
    );
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
