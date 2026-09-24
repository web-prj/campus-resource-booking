import { beforeEach, describe, expect, it, vi } from "vitest";
import ResourceDetailPage from "./page";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getResourceAvailability,
  getResourceDetail,
} from "@/features/resources/api/server";
import { SessionExpiredError } from "@/lib/api/session";
import { notFound, redirect } from "next/navigation";
import type { Resource, ResourceAvailability } from "@/features/resources/types";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/resources/api/server", () => ({
  getResourceAvailability: vi.fn(),
  getResourceDetail: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const resource: Resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: "A group study room.",
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard", "display"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building: {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MAIN",
    name: "Main Academic Building",
    address: "USTH Campus, Hanoi",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const student = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Availability Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const availability: ResourceAvailability = {
  resourceId: resource.id,
  date: "2099-01-05",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "active",
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  blockedReason: null,
  closureReason: null,
  requiresApproval: false,
  slots: [
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "11:00" },
    { startTime: "12:00", endTime: "13:00" },
  ],
};

function page(searchParams: Record<string, string | string[] | undefined> = {}) {
  return ResourceDetailPage({
    params: Promise.resolve({ id: resource.id }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe("ResourceDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getResourceDetail).mockReset();
    vi.mocked(getResourceAvailability).mockReset();
    vi.mocked(notFound).mockClear();
    vi.mocked(redirect).mockClear();
  });

  it("rejects malformed resource identifiers before authentication", async () => {
    await expect(
      ResourceDetailPage({
        params: Promise.resolve({ id: "not-a-uuid" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("notFound");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors to the requested internal detail route", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(page()).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent(`/resources/${resource.id}`)}`,
    );
    expect(getResourceDetail).not.toHaveBeenCalled();
  });

  it("loads authoritative availability for a real requested date", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockResolvedValue(resource);
    vi.mocked(getResourceAvailability).mockResolvedValue(availability);

    const result = await page({ date: availability.date, startTime: "09:00" });

    expect(getResourceDetail).toHaveBeenCalledWith(resource.id);
    expect(getResourceAvailability).toHaveBeenCalledWith(
      resource.id,
      availability.date,
    );
    expect(result.props).toMatchObject({
      user: student,
      resource,
      availability,
      checkedDate: availability.date,
      selectedSlot: availability.slots[0],
    });
  });

  it("accepts only a contiguous available multi-hour selection", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockResolvedValue(resource);
    vi.mocked(getResourceAvailability).mockResolvedValue(availability);

    const contiguous = await page({
      date: availability.date,
      startTime: "09:00",
      endTime: "11:00",
    });
    expect(contiguous.props.selectedSlot).toEqual({
      startTime: "09:00",
      endTime: "11:00",
    });

    expect(contiguous.props.isSlotAvailable).toBe(true);

    const gap = await page({
      date: availability.date,
      startTime: "10:00",
      endTime: "13:00",
    });
    expect(gap.props.selectedSlot).toEqual({
      startTime: "10:00",
      endTime: "13:00",
    });
    expect(gap.props.isSlotAvailable).toBe(false);
  });

  it("keeps a complete range that was just booked so the page can explain it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockResolvedValue(resource);
    vi.mocked(getResourceAvailability).mockResolvedValue({
      ...availability,
      slots: [{ startTime: "12:00", endTime: "13:00" }],
    });

    const result = await page({
      date: availability.date,
      startTime: "09:00",
      endTime: "10:00",
    });

    expect(result.props.selectedSlot).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result.props.isSlotAvailable).toBe(false);
  });

  it("treats a start time without an end time as a single available slot", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockResolvedValue(resource);
    vi.mocked(getResourceAvailability).mockResolvedValue(availability);

    const available = await page({ date: availability.date, startTime: "10:00" });
    expect(available.props.selectedSlot).toEqual({
      startTime: "10:00",
      endTime: "11:00",
    });
    expect(available.props.isSlotAvailable).toBe(true);

    const unavailable = await page({ date: availability.date, startTime: "11:00" });
    expect(unavailable.props.selectedSlot).toBeUndefined();
  });

  it.each([
    { startTime: "11:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "10:00" },
    { startTime: "06:00", endTime: "07:00" },
    { startTime: "17:00", endTime: "19:00" },
    { startTime: "10:30", endTime: "11:00" },
    { endTime: "11:00" },
  ])("selects nothing for an incomplete or invalid range %o", async (range) => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockResolvedValue(resource);
    vi.mocked(getResourceAvailability).mockResolvedValue(availability);

    const result = await page({ date: availability.date, ...range });

    expect(result.props.selectedSlot).toBeUndefined();
    expect(result.props.isSlotAvailable).toBe(false);
  });

  it("returns an expired session to sign in for the same date and interval", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDetail).mockRejectedValue(new SessionExpiredError());

    await expect(
      page({ date: availability.date, startTime: "09:00", endTime: "11:00" }),
    ).rejects.toThrow(
      `redirect:/login?next=${encodeURIComponent(
        `/resources/${resource.id}?date=${availability.date}&startTime=09%3A00&endTime=11%3A00`,
      )}`,
    );
  });
});
