import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "@/lib/api/session";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBookings } from "@/features/bookings/api/server";
import { redirect } from "next/navigation";
import BookingsPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/bookings/api/server", () => ({
  getStudentBookings: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const student = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const timeline = { upcoming: [], history: [] };

describe("BookingsPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStudentBookings).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects an anonymous visitor to the safe bookings destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(BookingsPage()).rejects.toThrow(
      "redirect:/login?next=/bookings",
    );
    expect(getStudentBookings).not.toHaveBeenCalled();
  });

  it("redirects non-students before loading student booking data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...student, role: "staff" });

    await expect(BookingsPage()).rejects.toThrow("redirect:/dashboard");
    expect(getStudentBookings).not.toHaveBeenCalled();
  });

  it("passes the authenticated student and authoritative timeline to the ledger", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBookings).mockResolvedValue(timeline);

    const page = await BookingsPage();

    expect(getStudentBookings).toHaveBeenCalledOnce();
    expect(page.props).toEqual({ user: student, timeline });
  });

  it("returns an expired session to sign in for the bookings page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBookings).mockRejectedValue(new SessionExpiredError());
    await expect(BookingsPage()).rejects.toThrow(
      "redirect:/login?next=%2Fbookings",
    );
  });
});
