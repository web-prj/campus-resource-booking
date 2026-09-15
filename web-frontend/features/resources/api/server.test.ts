import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ toString: (): string => "access_token=test" })),
}));

import { getResourceAvailability } from "./server";

const resourceId = "20000000-0000-4000-8000-000000000001";
const requestedDate = "2026-09-15";
const availability = {
  resourceId,
  date: requestedDate,
  timeZone: "Asia/Ho_Chi_Minh",
  opensAt: "08:00",
  closesAt: "18:00",
  blockedReason: null,
  closureReason: null,
  requiresApproval: false,
  slots: Array.from({ length: 10 }, (_, index) => ({
    startTime: `${String(index + 8).padStart(2, "0")}:00`,
    endTime: `${String(index + 9).padStart(2, "0")}:00`,
  })),
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resource availability server API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("INTERNAL_API_URL", "http://backend:18320/api");
  });

  it("accepts availability only for the requested resource and date", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(availability));

    await expect(
      getResourceAvailability(resourceId, requestedDate, request),
    ).resolves.toEqual(availability);
    expect(request).toHaveBeenCalledWith(
      `http://backend:18320/api/resources/${resourceId}/availability?date=${requestedDate}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it.each([
    [
      "another resource",
      {
        ...availability,
        resourceId: "20000000-0000-4000-8000-000000000002",
      },
    ],
    ["another date", { ...availability, date: "2026-09-16" }],
  ])("rejects a valid-shaped response for %s", async (_label, body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(body));

    await expect(
      getResourceAvailability(resourceId, requestedDate, request),
    ).rejects.toThrow("invalid availability data");
  });
});
