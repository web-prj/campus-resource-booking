import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { SessionExpiredError } from "@/lib/api/session";
import {
  getStaffBooking,
  getStaffBookingQueue,
  getStaffOperationsQueue,
  getStaffResourceSchedule,
} from "./staff-server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const booking = {
  id: "60000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "pending",
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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("staff booking server API", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({
      toString: () => "access_token=session",
    } as never);
    vi.stubEnv("INTERNAL_API_URL", "http://backend:18320/api");
  });

  it("loads the oldest-first queue page with cookie credentials and no caching", async () => {
    const queue = { items: [booking], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(queue));

    await expect(getStaffBookingQueue(1, request)).resolves.toEqual(queue);
    expect(request).toHaveBeenCalledWith(
      "http://backend:18320/api/staff/bookings/pending?page=1&pageSize=20",
      {
        headers: { Cookie: "access_token=session" },
        cache: "no-store",
      },
    );
  });

  it("requests the operations page and keeps totals across all pages", async () => {
    const confirmed = {
      ...booking,
      status: "confirmed",
      canReview: false,
      reviewedAt: "2026-09-15T01:00:00.000Z",
      reviewer: booking.requester,
    };
    const operations = {
      items: [confirmed],
      total: 21,
      page: 2,
      pageSize: 20,
      totalPages: 2,
      campusDate: "2099-01-05",
    };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(operations));

    await expect(getStaffOperationsQueue(2, request)).resolves.toMatchObject({
      total: 21,
      page: 2,
      totalPages: 2,
    });
    expect(request.mock.calls[0][0]).toBe(
      "http://backend:18320/api/staff/bookings/operations?page=2&pageSize=20",
    );
  });

  it("rejects a queue page that does not match the requested page", async () => {
    const queue = { items: [booking], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    await expect(
      getStaffBookingQueue(
        2,
        vi.fn<typeof fetch>().mockResolvedValue(response(queue)),
      ),
    ).rejects.toThrow("invalid queue data");
  });

  it("rejects malformed or duplicate queue and operations data", async () => {
    const duplicate = {
      items: [booking, booking],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      campusDate: "2099-01-05",
    };
    await expect(
      getStaffBookingQueue(
        1,
        vi.fn<typeof fetch>().mockResolvedValue(response(duplicate)),
      ),
    ).rejects.toThrow("invalid queue data");

    await expect(
      getStaffOperationsQueue(
        1,
        vi.fn<typeof fetch>().mockResolvedValue(response(duplicate)),
      ),
    ).rejects.toThrow("invalid operations data");
  });

  it("signals an expired session instead of a generic failure", async () => {
    const unauthorized = () =>
      vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    await expect(getStaffBookingQueue(1, unauthorized())).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    await expect(
      getStaffBooking(booking.id, unauthorized()),
    ).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("returns null only for a missing detail and rejects out-of-scope responses", async () => {
    await expect(
      getStaffBooking(
        booking.id,
        vi.fn<typeof fetch>().mockResolvedValue(response({}, 404)),
      ),
    ).resolves.toBeNull();

    await expect(
      getStaffBooking(
        booking.id,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({ ...booking, id: "60000000-0000-4000-8000-000000000002" }),
        ),
      ),
    ).rejects.toThrow("invalid booking data");
  });

  it("validates resource and date scope for schedule responses", async () => {
    await expect(
      getStaffResourceSchedule(
        booking.resource.id,
        booking.date,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({
            resourceId: booking.resource.id,
            date: "2099-01-06",
            bookings: [booking],
          }),
        ),
      ),
    ).rejects.toThrow("invalid schedule data");
  });
});
