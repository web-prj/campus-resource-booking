import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBooking } from "@/features/bookings/api/server";
import { notFound, redirect } from "next/navigation";
import BookingDetailPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/bookings/api/server", () => ({
  getStudentBooking: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const id = "40000000-0000-4000-8000-000000000001";
const student = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const booking = {
  id,
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh" as const,
  status: "confirmed" as const,
  canCancel: true,
  canRequestCheckIn: false,
  hasEnded: false,
  checkInCode: null,
  checkInRequestedAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  cancelledAt: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room" as const,
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

function pageParams(value = id) {
  return { params: Promise.resolve({ id: value }) };
}

describe("BookingDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStudentBooking).mockReset();
    vi.mocked(notFound).mockClear();
    vi.mocked(redirect).mockClear();
  });

  it("rejects an invalid booking identifier before session or data lookup", async () => {
    await expect(BookingDetailPage(pageParams("invalid"))).rejects.toThrow(
      "notFound",
    );
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getStudentBooking).not.toHaveBeenCalled();
  });

  it("redirects an anonymous visitor to the exact safe detail destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(BookingDetailPage(pageParams())).rejects.toThrow(
      `redirect:/login?next=/bookings/${id}`,
    );
    expect(getStudentBooking).not.toHaveBeenCalled();
  });

  it("redirects non-students before loading booking details", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...student, role: "admin" });

    await expect(BookingDetailPage(pageParams())).rejects.toThrow(
      "redirect:/dashboard",
    );
    expect(getStudentBooking).not.toHaveBeenCalled();
  });

  it("returns not found when the owned booking lookup has no result", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBooking).mockResolvedValue(null);

    await expect(BookingDetailPage(pageParams())).rejects.toThrow("notFound");
    expect(getStudentBooking).toHaveBeenCalledWith(id);
  });

  it("passes the authenticated student and owned booking to the detail flow", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBooking).mockResolvedValue(booking);

    const page = await BookingDetailPage(pageParams());

    expect(page.props).toEqual({ user: student, booking });
  });
});
