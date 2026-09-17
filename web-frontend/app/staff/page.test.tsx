import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getStaffBookingQueue,
  getStaffOperationsQueue,
} from "@/features/bookings/api/staff-server";
import { redirect } from "next/navigation";
import StaffDashboardPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/bookings/api/staff-server", () => ({
  getStaffBookingQueue: vi.fn(),
  getStaffOperationsQueue: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const staff = {
  id: "30000000-0000-4000-8000-000000000009",
  email: "staff@usth.edu.vn",
  fullName: "Campus Staff",
  role: "staff" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const queue = { items: [], total: 0 };
const operations = { items: [], total: 0, campusDate: "2099-01-05" };

describe("StaffDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStaffBookingQueue).mockReset();
    vi.mocked(getStaffOperationsQueue).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects anonymous visitors to the staff destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(StaffDashboardPage()).rejects.toThrow(
      "redirect:/login?next=/staff",
    );
    expect(getStaffBookingQueue).not.toHaveBeenCalled();
  });

  it("redirects non-staff users before loading operational data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...staff, role: "admin" });
    await expect(StaffDashboardPage()).rejects.toThrow("redirect:/dashboard");
    expect(getStaffBookingQueue).not.toHaveBeenCalled();
  });

  it("passes authoritative queue and operations data to the staff dashboard", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBookingQueue).mockResolvedValue(queue);
    vi.mocked(getStaffOperationsQueue).mockResolvedValue(operations);

    const page = await StaffDashboardPage();

    expect(getStaffBookingQueue).toHaveBeenCalledOnce();
    expect(getStaffOperationsQueue).toHaveBeenCalledOnce();
    expect(page.props).toEqual({ user: staff, queue, operations });
  });
});
