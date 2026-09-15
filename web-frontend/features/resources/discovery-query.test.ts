import { describe, expect, it } from "vitest";
import {
  discoveryHref,
  discoverySearchParams,
  normalizeDiscoveryFilters,
} from "./discovery-query";

const BUILDING_ID = "10000000-0000-4000-8000-000000000001";

describe("resource discovery query", () => {
  it("normalizes supported filters and ignores hostile or repeated values", () => {
    expect(
      normalizeDiscoveryFilters({
        q: "  projector  ",
        buildingId: BUILDING_ID,
        type: "equipment",
        minCapacity: "4",
        amenity: "  HDMI-Cable ",
        sort: "capacity_desc",
        date: "2026-09-15",
        startTime: "09:00",
        endTime: "11:00",
        page: "2",
        unknown: "value",
      }),
    ).toEqual({
      q: "projector",
      buildingId: BUILDING_ID,
      type: "equipment",
      minCapacity: 4,
      amenity: "hdmi-cable",
      sort: "capacity_desc",
      date: "2026-09-15",
      startTime: "09:00",
      endTime: "11:00",
      page: 2,
    });

    expect(
      normalizeDiscoveryFilters({
        q: ["one", "two"],
        buildingId: "not-a-uuid",
        type: "vehicle",
        minCapacity: "0",
        amenity: "x".repeat(51),
        sort: "newest",
        date: "2026-02-30",
        startTime: "11:00",
        endTime: "10:00",
        page: "-1",
      }),
    ).toEqual({});
  });

  it("builds deterministic API and navigation parameters", () => {
    const filters = {
      q: "study room",
      buildingId: BUILDING_ID,
      type: "room" as const,
      minCapacity: 8,
      amenity: "whiteboard",
      sort: "capacity_asc" as const,
      date: "2026-09-15",
      startTime: "09:00",
      endTime: "11:00",
      page: 3,
    };

    expect(discoverySearchParams(filters).toString()).toBe(
      `q=study+room&buildingId=${BUILDING_ID}&type=room&minCapacity=8&amenity=whiteboard&date=2026-09-15&startTime=09%3A00&endTime=11%3A00&sort=capacity_asc&page=3`,
    );
    expect(discoveryHref(filters, { page: 2 })).toBe(
      `/resources?q=study+room&buildingId=${BUILDING_ID}&type=room&minCapacity=8&amenity=whiteboard&date=2026-09-15&startTime=09%3A00&endTime=11%3A00&sort=capacity_asc&page=2`,
    );
  });

  it("omits default sorting and the first page", () => {
    expect(
      discoverySearchParams({ sort: "name_asc", page: 1 }).toString(),
    ).toBe("");
    expect(discoveryHref({ sort: "name_asc", page: 1 })).toBe("/resources");
  });
});
