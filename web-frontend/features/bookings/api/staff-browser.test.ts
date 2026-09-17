import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkOutStaffBooking,
  confirmStaffCheckIn,
  markStaffBookingNoShow,
  StaffBookingActionError,
} from "./staff-browser";

const id = "40000000-0000-4000-8000-000000000001";
const base = {
  id,
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  canReview: false,
  checkInRequested: true,
  canConfirmCheckIn: true,
  canCheckOut: false,
  canMarkNoShow: false,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room",
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
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

describe("staff lifecycle browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("posts a six-digit code with cookie credentials and validates the transition", async () => {
    const checkedIn = {
      ...base,
      status: "checked_in",
      canConfirmCheckIn: false,
      canCheckOut: true,
      checkedInAt: "2099-01-05T02:00:00.000Z",
    };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(checkedIn));

    await expect(confirmStaffCheckIn(id, "482193", request)).resolves.toEqual(
      checkedIn,
    );
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/staff/bookings/${id}/confirm-check-in`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ code: "482193" }),
      }),
    );
  });

  it.each([
    [400, "validation", "six-digit code"],
    [401, "session", "updating this visit"],
    [403, "forbidden", "staff accounts"],
    [404, "not-found", "no longer exists"],
    [409, "conflict", "no longer eligible"],
  ] as const)(
    "maps lifecycle HTTP %i to contextual %s recovery",
    async (status, code, message) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({}, status));
      await expect(
        confirmStaffCheckIn(id, "482193", request),
      ).rejects.toMatchObject({
        code,
        message: expect.stringContaining(message),
      } satisfies Partial<StaffBookingActionError>);
    },
  );

  it("rejects malformed transition responses", async () => {
    await expect(
      checkOutStaffBooking(
        id,
        vi.fn<typeof fetch>().mockResolvedValue(response(base)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
    await expect(
      markStaffBookingNoShow(
        id,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({ ...base, status: "no_show", canConfirmCheckIn: false }),
        ),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });
});
