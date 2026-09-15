import type {
  ResourceDiscoveryFilters,
  ResourceSort,
  ResourceType,
} from "./types";

export type DiscoverySearchParams = Record<
  string,
  string | string[] | undefined
>;

const RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set([
  "room",
  "laboratory",
  "equipment",
]);
const RESOURCE_SORTS: ReadonlySet<ResourceSort> = new Set([
  "name_asc",
  "capacity_asc",
  "capacity_desc",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boundedText(
  value: string | string[] | undefined,
  maxLength: number,
): string | undefined {
  const normalized = one(value)?.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function boundedInteger(
  value: string | string[] | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  const normalized = one(value);
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : undefined;
}

export function normalizeDiscoveryFilters(
  params: DiscoverySearchParams,
): ResourceDiscoveryFilters {
  const filters: ResourceDiscoveryFilters = {};
  const q = boundedText(params.q, 120);
  const buildingId = one(params.buildingId);
  const type = one(params.type);
  const amenity = boundedText(params.amenity, 50)?.toLowerCase();
  const sort = one(params.sort);
  const minCapacity = boundedInteger(params.minCapacity, 1, 10000);
  const page = boundedInteger(params.page, 1, Number.MAX_SAFE_INTEGER);
  const date = one(params.date);
  const startTime = one(params.startTime);
  const endTime = one(params.endTime);

  if (q) filters.q = q;
  if (buildingId && UUID_PATTERN.test(buildingId)) {
    filters.buildingId = buildingId;
  }
  if (type && RESOURCE_TYPES.has(type as ResourceType)) {
    filters.type = type as ResourceType;
  }
  if (minCapacity !== undefined) filters.minCapacity = minCapacity;
  if (amenity) filters.amenity = amenity;
  if (
    date &&
    isCalendarDate(date) &&
    startTime &&
    HOUR_PATTERN.test(startTime) &&
    endTime &&
    HOUR_PATTERN.test(endTime) &&
    startTime < endTime
  ) {
    filters.date = date;
    filters.startTime = startTime;
    filters.endTime = endTime;
  }
  if (sort && RESOURCE_SORTS.has(sort as ResourceSort)) {
    filters.sort = sort as ResourceSort;
  }
  if (page !== undefined) filters.page = page;

  return filters;
}

export function discoverySearchParams(
  filters: ResourceDiscoveryFilters,
  overrides: Partial<ResourceDiscoveryFilters> = {},
): URLSearchParams {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.buildingId) params.set("buildingId", merged.buildingId);
  if (merged.type) params.set("type", merged.type);
  if (merged.minCapacity !== undefined) {
    params.set("minCapacity", String(merged.minCapacity));
  }
  if (merged.amenity) params.set("amenity", merged.amenity);
  if (merged.date && merged.startTime && merged.endTime) {
    params.set("date", merged.date);
    params.set("startTime", merged.startTime);
    params.set("endTime", merged.endTime);
  }
  if (merged.sort && merged.sort !== "name_asc") {
    params.set("sort", merged.sort);
  }
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));

  return params;
}

export function discoveryHref(
  filters: ResourceDiscoveryFilters,
  overrides: Partial<ResourceDiscoveryFilters> = {},
): string {
  const query = discoverySearchParams(filters, overrides).toString();
  return query ? `/resources?${query}` : "/resources";
}
