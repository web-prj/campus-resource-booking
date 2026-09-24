import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getStaffBookingQueue,
  getStaffOperationsQueue,
} from "@/features/bookings/api/staff-server";
import { SessionExpiredError } from "@/lib/api/session";
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
const queue = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
const operations = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  campusDate: "2099-01-05",
};

function render(searchParams: Record<string, string | string[] | undefined> = {}) {
  return StaffDashboardPage({ searchParams: Promise.resolve(searchParams) });
}

describe("StaffDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStaffBookingQueue).mockReset();
    vi.mocked(getStaffOperationsQueue).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects anonymous visitors to the staff destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(render()).rejects.toThrow(`redirect:/login?next=${encodeURIComponent("/staff")}`);
    expect(getStaffBookingQueue).not.toHaveBeenCalled();
  });

  it("keeps the requested queue pages in the login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(render({ pendingPage: "2", operationsPage: "abc" })).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/staff?pendingPage=2")}`,
    );
  });

  it("redirects students before loading operational data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...staff, role: "student" });
    await expect(render()).rejects.toThrow("redirect:/dashboard");
    expect(getStaffBookingQueue).not.toHaveBeenCalled();
  });

  it("passes authoritative queue and operations data to the staff dashboard", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBookingQueue).mockResolvedValue(queue);
    vi.mocked(getStaffOperationsQueue).mockResolvedValue(operations);

    const page = await render();

    expect(getStaffBookingQueue).toHaveBeenCalledWith(1);
    expect(getStaffOperationsQueue).toHaveBeenCalledWith(1);
    expect(page.props).toEqual({ user: staff, queue, operations });
  });

  it("lets administrators use the staff tools", async () => {
    const admin = { ...staff, role: "admin" as const };
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(getStaffBookingQueue).mockResolvedValue(queue);
    vi.mocked(getStaffOperationsQueue).mockResolvedValue(operations);

    const page = await render();

    expect(page.props.user).toEqual(admin);
  });

  it("loads each queue page independently and treats invalid pages as page 1", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBookingQueue).mockResolvedValue({
      ...queue,
      total: 45,
      totalPages: 3,
      page: 1,
    });
    vi.mocked(getStaffOperationsQueue).mockResolvedValue({
      ...operations,
      total: 30,
      totalPages: 2,
      page: 2,
    });

    await render({ pendingPage: "abc", operationsPage: "2" });

    expect(getStaffBookingQueue).toHaveBeenCalledWith(1);
    expect(getStaffOperationsQueue).toHaveBeenCalledWith(2);

    for (const invalid of ["0", "-3", "1.5", ["2", "3"]]) {
      vi.mocked(getStaffBookingQueue).mockClear();
      await render({ pendingPage: invalid });
      expect(getStaffBookingQueue).toHaveBeenCalledWith(1);
    }
  });

  it("clamps out-of-range queue pages to the last page while keeping the other queue page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBookingQueue).mockResolvedValue({
      ...queue,
      items: [],
      total: 41,
      totalPages: 3,
      page: 9,
    });
    vi.mocked(getStaffOperationsQueue).mockResolvedValue({
      ...operations,
      total: 25,
      totalPages: 2,
      page: 2,
    });

    await expect(
      render({ pendingPage: "9", operationsPage: "2" }),
    ).rejects.toThrow("redirect:/staff?pendingPage=3&operationsPage=2");
  });

  it("sends an expired session back to sign in with the current queue pages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff);
    vi.mocked(getStaffBookingQueue).mockRejectedValue(new SessionExpiredError());
    vi.mocked(getStaffOperationsQueue).mockResolvedValue(operations);

    await expect(
      render({ pendingPage: "2", operationsPage: "3" }),
    ).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent("/staff?pendingPage=2&operationsPage=3")}`,
    );
  });
});
