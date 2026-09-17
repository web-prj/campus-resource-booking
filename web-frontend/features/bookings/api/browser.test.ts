import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingRequestError,
  createBookingRequest,
  requestStudentCheckIn,
} from "./browser";

const requesterId = "30000000-0000-4000-8000-000000000001";
const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};
const result = {
  id: "40000000-0000-4000-8000-000000000001",
  requesterId,
  ...input,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
};

function response(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("booking request browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("posts the scoped interval with cookie credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(result));

    await expect(
      createBookingRequest(input, requesterId, request),
    ).resolves.toEqual(result);
    expect(request).toHaveBeenCalledWith(
      "http://localhost:18320/api/bookings",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(input),
      }),
    );
  });

  it("generates a scoped check-in code with credentialed PATCH semantics", async () => {
    const booking = {
      id: result.id,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      canCancel: false,
      canRequestCheckIn: false,
      hasEnded: false,
      checkInCode: "482193",
      checkInRequestedAt: "2099-01-05T01:50:00.000Z",
      checkedInAt: null,
      checkedOutAt: null,
      noShowAt: null,
      cancelledAt: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: result.createdAt,
      resource: {
        id: input.resourceId,
        code: "ROOM-A101",
        name: "Study Room A101",
        type: "room",
        location: "First floor",
        buildingCode: "MAIN",
        buildingName: "Main Academic Building",
      },
    };
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(booking, 200));

    await expect(requestStudentCheckIn(result.id, request)).resolves.toEqual(
      booking,
    );
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/bookings/mine/${result.id}/check-in`,
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
  });

  it("rejects check-in responses that retain invalid lifecycle state", async () => {
    const invalid = {
      id: result.id,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: "Asia/Ho_Chi_Minh",
      status: "checked_in",
      canCancel: false,
      canRequestCheckIn: false,
      hasEnded: false,
      checkInCode: "482193",
      checkInRequestedAt: "2099-01-05T01:50:00.000Z",
      checkedInAt: "2099-01-05T02:00:00.000Z",
      checkedOutAt: null,
      noShowAt: null,
      cancelledAt: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: result.createdAt,
      resource: {
        id: input.resourceId,
        code: "ROOM-A101",
        name: "Study Room A101",
        type: "room",
        location: "First floor",
        buildingCode: "MAIN",
        buildingName: "Main Academic Building",
      },
    };

    await expect(
      requestStudentCheckIn(
        result.id,
        vi.fn<typeof fetch>().mockResolvedValue(response(invalid, 200)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });

  it.each([
    [400, "validation"],
    [401, "session"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [429, "rate-limit"],
    [500, "unexpected"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));

    await expect(
      createBookingRequest(input, requesterId, request),
    ).rejects.toMatchObject({ code } satisfies Partial<BookingRequestError>);
  });

  it("maps network errors and rejects out-of-scope success data", async () => {
    await expect(
      createBookingRequest(
        input,
        requesterId,
        vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      ),
    ).rejects.toMatchObject({ code: "network" });

    await expect(
      createBookingRequest(
        input,
        requesterId,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({ ...result, resourceId: "20000000-0000-4000-8000-000000000002" }),
        ),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });
});
