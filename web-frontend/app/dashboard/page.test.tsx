import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "@/lib/api/session";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBookings } from "@/features/bookings/api/server";
import {
  getResourceAvailability,
  getResourceDirectory,
} from "@/features/resources/api/server";
import { redirect } from "next/navigation";
import DashboardPage from "./page";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/bookings/api/server", () => ({
  getStudentBookings: vi.fn(),
}));
vi.mock("@/features/resources/api/server", () => ({
  getResourceAvailability: vi.fn(),
  getResourceDirectory: vi.fn(),
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
const resources = Array.from({ length: 4 }, (_, index) => ({
  id: `20000000-0000-4000-8000-00000000000${index + 1}`,
  name: `Resource ${index + 1}`,
}));
const timeline = { upcoming: [], history: [] };
const directory = {
  page: {
    items: resources,
    total: 4,
    page: 1,
    pageSize: 9,
    totalPages: 1,
  },
  buildings: [],
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getStudentBookings).mockReset();
    vi.mocked(getResourceDirectory).mockReset();
    vi.mocked(getResourceAvailability).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects anonymous visitors before loading dashboard data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(DashboardPage()).rejects.toThrow(
      "redirect:/login?next=/dashboard",
    );
    expect(getStudentBookings).not.toHaveBeenCalled();
    expect(getResourceDirectory).not.toHaveBeenCalled();
  });

  it.each([
    ["staff", "/staff"],
    ["admin", "/admin/resources"],
  ] as const)("redirects %s accounts to their role workspace", async (role, path) => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...student, role });

    await expect(DashboardPage()).rejects.toThrow(`redirect:${path}`);
    expect(getStudentBookings).not.toHaveBeenCalled();
    expect(getResourceDirectory).not.toHaveBeenCalled();
  });

  it("composes authoritative student data for only the displayed resources", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBookings).mockResolvedValue(timeline);
    vi.mocked(getResourceDirectory).mockResolvedValue(directory as never);
    vi.mocked(getResourceAvailability).mockImplementation(async (id, date) => ({
      resourceId: id,
      date,
    }) as never);

    const page = await DashboardPage();
    const dates = vi.mocked(getResourceAvailability).mock.calls.map((call) => call[1]);

    expect(getStudentBookings).toHaveBeenCalledOnce();
    expect(getResourceDirectory).toHaveBeenCalledWith({});
    expect(getResourceAvailability).toHaveBeenCalledTimes(3);
    expect(vi.mocked(getResourceAvailability).mock.calls.map((call) => call[0])).toEqual(
      resources.slice(0, 3).map(({ id }) => id),
    );
    expect(new Set(dates).size).toBe(1);
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page.props).toMatchObject({
      user: student,
      timeline,
      totalResources: 4,
      campusDate: dates[0],
    });
    expect(page.props.resources).toHaveLength(3);
  });

  it("returns an expired session to sign in for the dashboard", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getStudentBookings).mockRejectedValue(new SessionExpiredError());
    vi.mocked(getResourceDirectory).mockRejectedValue(new SessionExpiredError());
    await expect(DashboardPage()).rejects.toThrow(
      "redirect:/login?next=%2Fdashboard",
    );
  });
});
