import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ toString: (): string => "access_token=test" })),
}));

import {
  getResourceAvailability,
  getResourceDetail,
  getResourceDirectory,
} from "./server";

const resourceId = "20000000-0000-4000-8000-000000000001";
const requestedDate = "2026-09-15";
const building = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "MAIN",
  name: "Main Academic Building",
  address: "USTH Campus, Hanoi",
};
const resource = {
  id: resourceId,
  code: "ROOM-A101",
  name: "Study Room A101",
  description: null,
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const availability = {
  resourceId,
  date: requestedDate,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "active",
  operatingDays: [1, 2, 3, 4, 5, 6],
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

describe("resource server API", () => {
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
  ])("rejects a valid-shaped availability response for %s", async (_label, body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(body));

    await expect(
      getResourceAvailability(resourceId, requestedDate, request),
    ).rejects.toThrow("invalid availability data");
  });

  it.each([
    [
      "another resource",
      { ...resource, id: "20000000-0000-4000-8000-000000000002" },
    ],
    ["a non-active resource", { ...resource, status: "maintenance" }],
  ])("rejects a valid-shaped detail response for %s", async (_label, body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(body));

    await expect(getResourceDetail(resourceId, request)).rejects.toThrow(
      "invalid resource data",
    );
  });

  it("accepts an empty out-of-range page so the route can canonicalize it", async () => {
    const page = {
      items: [],
      total: 1,
      page: 99,
      pageSize: 9,
      totalPages: 1,
    };
    const request = vi.fn<typeof fetch>(async (input) =>
      response(String(input).includes("/resources?") ? page : [building]),
    );

    await expect(getResourceDirectory({ page: 99 }, request)).resolves.toEqual({
      page,
      buildings: [building],
    });
  });

  it.each([
    ["another page", { page: 2 }],
    ["another page size", { pageSize: 8 }],
    ["a non-active item", { items: [{ ...resource, status: "inactive" }] }],
  ])("rejects discovery data scoped to %s", async (_label, overrides) => {
    const page = {
      items: [resource],
      total: 1,
      page: 1,
      pageSize: 9,
      totalPages: 1,
      ...overrides,
    };
    const request = vi.fn<typeof fetch>(async (input) =>
      response(String(input).includes("/resources?") ? page : [building]),
    );

    await expect(getResourceDirectory({}, request)).rejects.toThrow(
      "invalid discovery data",
    );
  });
});
