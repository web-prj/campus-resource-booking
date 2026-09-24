import { describe, expect, it } from "vitest";
import {
  parseBuildings,
  parseResource,
  parseResourceAvailability,
  parseResourceBookingConflict,
  parseResourceClosure,
  parseResourcePage,
  parseResources,
} from "./schema";

const building = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "MAIN",
  name: "Main Academic Building",
  address: "USTH Campus, Hanoi",
};

const resource = {
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
  building,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("resource response schemas", () => {
  it("parses valid resources and buildings", () => {
    expect(parseResource(resource)).toEqual(resource);
    expect(parseResources([resource])).toEqual([resource]);
    expect(parseBuildings([building])).toEqual([building]);
  });

  it.each([
    { ...resource, type: "vehicle" },
    { ...resource, status: "broken" },
    { ...resource, capacity: 0 },
    { ...resource, capacity: 10001 },
    { ...resource, id: "not-a-uuid" },
    { ...resource, createdAt: "not-a-date" },
    { ...resource, amenities: ["whiteboard", 4] },
    { ...resource, operatingDays: [] },
    { ...resource, operatingDays: [1, 8] },
    { ...resource, opensAt: "08:30" },
    { ...resource, opensAt: "18:00", closesAt: "08:00" },
    { ...resource, building: { code: "MAIN" } },
  ])("rejects malformed resource data", (value) => {
    expect(parseResource(value)).toBeNull();
  });

  it("strictly parses availability and closure responses", () => {
    const availability = {
      resourceId: resource.id,
      date: "2026-09-15",
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
    const closure = {
      id: "40000000-0000-4000-8000-000000000001",
      resourceId: resource.id,
      date: "2026-09-18",
      reason: "Campus maintenance",
      createdAt: "2026-09-01T00:00:00.000Z",
    };

    expect(parseResourceAvailability(availability)).toEqual(availability);
    expect(
      parseResourceAvailability({
        ...availability,
        slots: availability.slots.filter(
          (slot) => slot.startTime !== "12:00",
        ),
      }),
    ).not.toBeNull();
    expect(parseResourceClosure(closure)).toEqual(closure);
    expect(
      parseResourceAvailability({
        ...availability,
        status: "maintenance",
        blockedReason: null,
      }),
    ).toBeNull();
    expect(
      parseResourceAvailability({
        ...availability,
        operatingDays: [1, 1],
      }),
    ).toBeNull();
    expect(
      parseResourceAvailability({ ...availability, blockedReason: "booked" }),
    ).toBeNull();
    expect(
      parseResourceAvailability({
        ...availability,
        slots: [{ startTime: "08:30", endTime: "09:30" }],
      }),
    ).toBeNull();

    for (const malformed of [
      { ...availability, date: "2026-02-30" },
      { ...availability, opensAt: "18:00", closesAt: "08:00" },
      {
        ...availability,
        slots: [{ startTime: "19:00", endTime: "20:00" }],
      },
      {
        ...availability,
        slots: [availability.slots[1], availability.slots[0]],
      },
      {
        ...availability,
        blockedReason: "maintenance",
        slots: [{ startTime: "08:00", endTime: "09:00" }],
      },
      {
        ...availability,
        blockedReason: "maintenance",
        closureReason: "Unrelated closure",
        slots: [],
      },
      {
        ...availability,
        blockedReason: "closure",
        closureReason: null,
        slots: [],
      },
    ]) {
      expect(parseResourceAvailability(malformed)).toBeNull();
    }

    expect(parseResourceClosure({ ...closure, resourceId: "bad" })).toBeNull();
    expect(parseResourceClosure({ ...closure, date: "2026-02-30" })).toBeNull();
    expect(parseResourceClosure({ ...closure, reason: " " })).toBeNull();
  });

  it("parses valid paginated discovery data", () => {
    expect(
      parseResourcePage({
        items: [resource],
        total: 10,
        page: 2,
        pageSize: 9,
        totalPages: 2,
      }),
    ).toEqual({
      items: [resource],
      total: 10,
      page: 2,
      pageSize: 9,
      totalPages: 2,
    });
  });

  it("parses an authoritative empty page beyond the last result page", () => {
    expect(
      parseResourcePage({
        items: [],
        total: 1,
        page: 99,
        pageSize: 9,
        totalPages: 1,
      }),
    ).toEqual({
      items: [],
      total: 1,
      page: 99,
      pageSize: 9,
      totalPages: 1,
    });
  });

  it.each([
    { items: [resource], total: -1, page: 1, pageSize: 9, totalPages: 0 },
    { items: [resource], total: 10, page: 0, pageSize: 9, totalPages: 2 },
    { items: [resource], total: 10, page: 1, pageSize: 25, totalPages: 1 },
    { items: [resource], total: 10, page: 1, pageSize: 9, totalPages: 3 },
    { items: [resource], total: 10, page: 1, pageSize: 9, totalPages: 2 },
    { items: [], total: 10, page: 2, pageSize: 9, totalPages: 2 },
    { items: [resource], total: 0, page: 1, pageSize: 9, totalPages: 0 },
    { items: Array(10).fill(resource), total: 10, page: 1, pageSize: 9, totalPages: 2 },
    { items: [resource], total: 1, page: 2, pageSize: 9, totalPages: 1 },
    {
      items: [{ ...resource, id: null }],
      total: 1,
      page: 1,
      pageSize: 9,
      totalPages: 1,
    },
  ])("rejects malformed paginated discovery data", (value) => {
    expect(parseResourcePage(value)).toBeNull();
  });

  it("rejects an array when any item is malformed", () => {
    expect(parseResources([resource, { ...resource, id: null }])).toBeNull();
    expect(
      parseBuildings([building, { ...building, address: null }]),
    ).toBeNull();
  });
});

describe("resource booking conflict schema", () => {
  const booking = {
    id: "70000000-0000-4000-8000-000000000001",
    date: "2099-01-05",
    startTime: "09:00",
    endTime: "10:30",
    status: "pending",
  };
  const conflict = {
    code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
    message: "Active bookings exist.",
    conflictCount: 11,
    conflictingBookings: [booking],
  };

  it("parses a valid active-booking conflict", () => {
    expect(parseResourceBookingConflict(conflict)).toEqual(conflict);
  });

  it("rejects other or inconsistent conflict bodies", () => {
    expect(parseResourceBookingConflict({ ...conflict, code: "DUPLICATE" })).toBeNull();
    expect(parseResourceBookingConflict({ statusCode: 409, message: "Duplicate" })).toBeNull();
    expect(parseResourceBookingConflict({ ...conflict, conflictCount: 0 })).toBeNull();
    expect(
      parseResourceBookingConflict({
        ...conflict,
        conflictCount: 1,
        conflictingBookings: [booking, { ...booking, id: "70000000-0000-4000-8000-000000000002" }],
      }),
    ).toBeNull();
    expect(
      parseResourceBookingConflict({
        ...conflict,
        conflictCount: 20,
        conflictingBookings: Array.from({ length: 11 }, (_, index) => ({
          ...booking,
          id: `70000000-0000-4000-8000-0000000000${String(index + 10)}`,
        })),
      }),
    ).toBeNull();
    expect(
      parseResourceBookingConflict({
        ...conflict,
        conflictingBookings: [{ ...booking, endTime: "08:00" }],
      }),
    ).toBeNull();
    expect(
      parseResourceBookingConflict({
        ...conflict,
        conflictingBookings: [{ ...booking, status: "cancelled" }],
      }),
    ).toBeNull();
    expect(
      parseResourceBookingConflict({ ...conflict, conflictingBookings: [booking, booking] }),
    ).toBeNull();
  });
});
