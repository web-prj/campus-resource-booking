import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getStudentBooking, getStudentBookings } from "./server";
import { SessionExpiredError } from "@/lib/api/session";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const booking = {
  id: "40000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  canCancel: false,
  canRequestCheckIn: false,
  hasEnded: true,
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
    type: "room",
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("student booking server API", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({
      toString: () => "access_token=session",
    } as never);
    vi.stubEnv("INTERNAL_API_URL", "http://backend:18320/api");
  });

  it("loads an uncached authoritative timeline and accepts ended confirmed history", async () => {
    const timeline = { upcoming: [], history: [booking] };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(timeline));

    await expect(getStudentBookings(request)).resolves.toEqual(timeline);
    expect(request).toHaveBeenCalledWith(
      "http://backend:18320/api/bookings/mine",
      {
        headers: { Cookie: "access_token=session" },
        cache: "no-store",
      },
    );
  });

  it("rejects malformed or duplicate timeline data", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ upcoming: [{ ...booking, canCancel: true, hasEnded: false }], history: [booking] }),
      );

    await expect(getStudentBookings(request)).rejects.toThrow(
      "invalid timeline data",
    );
  });

  it("returns null only for a 404 and rejects an out-of-scope detail", async () => {
    await expect(
      getStudentBooking(
        booking.id,
        vi.fn<typeof fetch>().mockResolvedValue(response({}, 404)),
      ),
    ).resolves.toBeNull();

    await expect(
      getStudentBooking(
        booking.id,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({
            ...booking,
            id: "40000000-0000-4000-8000-000000000002",
          }),
        ),
      ),
    ).rejects.toThrow("invalid booking data");
  });

  it("signals an expired session instead of a generic failure", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    await expect(getStudentBookings(request)).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
