import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingRequestError,
  createBookingRequest,
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
