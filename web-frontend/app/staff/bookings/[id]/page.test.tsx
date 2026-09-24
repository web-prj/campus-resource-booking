import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getStaffBooking,
  getStaffResourceSchedule,
} from "@/features/bookings/api/staff-server";
import { SessionExpiredError } from "@/lib/api/session";
import { notFound, redirect } from "next/navigation";
import StaffBookingDetailPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/bookings/api/staff-server", () => ({
  getStaffBooking: vi.fn(),
  getStaffResourceSchedule: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const id = "60000000-0000-4000-8000-000000000001";
const staff = {
  id: "30000000-0000-4000-8000-000000000009",
  email: "staff@usth.edu.vn",
  fullName: "Campus Staff",
  role: "staff" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const booking = {
  id,
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh" as const,
  status: "pending" as const,
  createdAt: "2026-09-15T00:00:00.000Z",
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
    type: "laboratory" as const,
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
const schedule = {
  resourceId: booking.resource.id,
  date: booking.date,
  bookings: [booking],
};

function pageParams(value = id) {
  return { params: Promise.resolve({ id: value }) };
}

describe("StaffBookingDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStaffBooking).mockReset();
    vi.mocked(getStaffResourceSchedule).mockReset();
    vi.mocked(notFound).mockClear();
    vi.mocked(redirect).mockClear();
  });

  it("rejects invalid identifiers before session lookup", async () => {
    await expect(StaffBookingDetailPage(pageParams("invalid"))).rejects.toThrow(
      "notFound",
    );
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors to the exact safe detail destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(StaffBookingDetailPage(pageParams())).rejects.toThrow(
      `redirect:/login?next=/staff/bookings/${id}`,
    );
    expect(getStaffBooking).not.toHaveBeenCalled();
  });

  it("redirects non-staff users before loading booking data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...staff, role: "student" });
    await expect(StaffBookingDetailPage(pageParams())).rejects.toThrow(
      "redirect:/dashboard",
    );
    expect(getStaffBooking).not.toHaveBeenCalled();
  });

  it("returns not found without loading a schedule for a missing booking", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBooking).mockResolvedValue(null);
    await expect(StaffBookingDetailPage(pageParams())).rejects.toThrow(
      "notFound",
    );
    expect(getStaffResourceSchedule).not.toHaveBeenCalled();
  });

  it("passes the authoritative booking and matching resource schedule", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBooking).mockResolvedValue(booking);
    vi.mocked(getStaffResourceSchedule).mockResolvedValue(schedule);

    const page = await StaffBookingDetailPage(pageParams());

    expect(getStaffResourceSchedule).toHaveBeenCalledWith(
      booking.resource.id,
      booking.date,
    );
    expect(page.props).toMatchObject({ user: staff, booking, schedule });
  });

  it("lets administrators review booking details", async () => {
    const admin = { ...staff, role: "admin" as const };
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getStaffBooking).mockResolvedValue(booking);
    vi.mocked(getStaffResourceSchedule).mockResolvedValue(schedule);

    const page = await StaffBookingDetailPage(pageParams());

    expect(page.props).toMatchObject({ user: admin, booking });
  });

  it("returns an expired session to sign in for the same booking", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBooking).mockRejectedValue(new SessionExpiredError());

    await expect(StaffBookingDetailPage(pageParams())).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent(`/staff/bookings/${booking.id}`)}`,
    );
  });
});
