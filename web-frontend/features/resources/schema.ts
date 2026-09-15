import type {
  AvailabilityBlockedReason,
  AvailabilitySlot,
  Building,
  Resource,
  ResourceAvailability,
  ResourceClosure,
  ResourcePage,
  ResourceStatus,
  ResourceType,
} from "./types";

const RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set([
  "room",
  "laboratory",
  "equipment",
]);
const RESOURCE_STATUSES: ReadonlySet<ResourceStatus> = new Set([
  "active",
  "maintenance",
  "inactive",
]);
const BLOCKED_REASONS: ReadonlySet<AvailabilityBlockedReason> = new Set([
  "maintenance",
  "inactive",
  "closure",
  "closed_day",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function timeInMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function parseBuilding(value: unknown): Building | null {
  if (!isRecord(value)) return null;
  const { id, code, name, address } = value;
  if (
    !isUuid(id) ||
    typeof code !== "string" ||
    typeof name !== "string" ||
    typeof address !== "string"
  ) {
    return null;
  }
  return { id, code, name, address };
}

export function parseResource(value: unknown): Resource | null {
  if (!isRecord(value)) return null;
  const {
    id,
    code,
    name,
    description,
    type,
    status,
    capacity,
    location,
    amenities,
    requiresApproval,
    operatingDays,
    opensAt,
    closesAt,
    building,
    createdAt,
    updatedAt,
  } = value;
  const parsedBuilding = parseBuilding(building);

  if (
    !isUuid(id) ||
    typeof code !== "string" ||
    typeof name !== "string" ||
    (description !== null && typeof description !== "string") ||
    typeof type !== "string" ||
    !RESOURCE_TYPES.has(type as ResourceType) ||
    typeof status !== "string" ||
    !RESOURCE_STATUSES.has(status as ResourceStatus) ||
    typeof capacity !== "number" ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10000 ||
    typeof location !== "string" ||
    !Array.isArray(amenities) ||
    !amenities.every((amenity) => typeof amenity === "string") ||
    typeof requiresApproval !== "boolean" ||
    !Array.isArray(operatingDays) ||
    operatingDays.length < 1 ||
    operatingDays.length > 7 ||
    !operatingDays.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    ) ||
    new Set(operatingDays).size !== operatingDays.length ||
    typeof opensAt !== "string" ||
    !HOUR_PATTERN.test(opensAt) ||
    typeof closesAt !== "string" ||
    !HOUR_PATTERN.test(closesAt) ||
    opensAt >= closesAt ||
    !parsedBuilding ||
    !isTimestamp(createdAt) ||
    !isTimestamp(updatedAt)
  ) {
    return null;
  }

  return {
    id,
    code,
    name,
    description,
    type: type as ResourceType,
    status: status as ResourceStatus,
    capacity,
    location,
    amenities,
    requiresApproval,
    operatingDays,
    opensAt,
    closesAt,
    building: parsedBuilding,
    createdAt,
    updatedAt,
  };
}

export function parseBuildings(value: unknown): Building[] | null {
  if (!Array.isArray(value)) return null;
  const buildings = value.map(parseBuilding);
  return buildings.every((building): building is Building => building !== null)
    ? buildings
    : null;
}

export function parseResources(value: unknown): Resource[] | null {
  if (!Array.isArray(value)) return null;
  const resources = value.map(parseResource);
  return resources.every((resource): resource is Resource => resource !== null)
    ? resources
    : null;
}

function parseAvailabilitySlot(value: unknown): AvailabilitySlot | null {
  if (!isRecord(value)) return null;
  const { startTime, endTime } = value;
  if (
    typeof startTime !== "string" ||
    !HOUR_PATTERN.test(startTime) ||
    typeof endTime !== "string" ||
    !HOUR_PATTERN.test(endTime) ||
    startTime >= endTime
  ) {
    return null;
  }
  return { startTime, endTime };
}

export function parseResourceAvailability(
  value: unknown,
): ResourceAvailability | null {
  if (!isRecord(value)) return null;
  const {
    resourceId,
    date,
    timeZone,
    opensAt,
    closesAt,
    blockedReason,
    closureReason,
    requiresApproval,
    slots,
  } = value;
  const parsedSlots = Array.isArray(slots) ? slots.map(parseAvailabilitySlot) : [];
  const parsedBlockedReason =
    typeof blockedReason === "string" &&
    BLOCKED_REASONS.has(blockedReason as AvailabilityBlockedReason)
      ? (blockedReason as AvailabilityBlockedReason)
      : blockedReason === null
        ? null
        : undefined;

  if (
    !isUuid(resourceId) ||
    !isCalendarDate(date) ||
    timeZone !== "Asia/Ho_Chi_Minh" ||
    typeof opensAt !== "string" ||
    !HOUR_PATTERN.test(opensAt) ||
    typeof closesAt !== "string" ||
    !HOUR_PATTERN.test(closesAt) ||
    opensAt >= closesAt ||
    parsedBlockedReason === undefined ||
    (closureReason !== null && typeof closureReason !== "string") ||
    (parsedBlockedReason === "closure"
      ? typeof closureReason !== "string" || closureReason.length === 0
      : closureReason !== null) ||
    typeof requiresApproval !== "boolean" ||
    !Array.isArray(slots) ||
    parsedSlots.some((slot) => slot === null)
  ) {
    return null;
  }

  const validSlots = parsedSlots as AvailabilitySlot[];
  const opensAtMinutes = timeInMinutes(opensAt);
  const closesAtMinutes = timeInMinutes(closesAt);
  if (
    (parsedBlockedReason !== null && validSlots.length > 0) ||
    validSlots.some((slot, index) => {
      const start = timeInMinutes(slot.startTime);
      const end = timeInMinutes(slot.endTime);
      const previous = index > 0 ? validSlots[index - 1] : null;
      return (
        end - start !== 60 ||
        start < opensAtMinutes ||
        end > closesAtMinutes ||
        (previous !== null && start < timeInMinutes(previous.endTime))
      );
    })
  ) {
    return null;
  }

  return {
    resourceId,
    date,
    timeZone,
    opensAt,
    closesAt,
    blockedReason: parsedBlockedReason,
    closureReason,
    requiresApproval,
    slots: validSlots,
  };
}

export function parseResourceClosure(value: unknown): ResourceClosure | null {
  if (!isRecord(value)) return null;
  const { id, resourceId, date, reason, createdAt } = value;
  if (
    !isUuid(id) ||
    !isUuid(resourceId) ||
    !isCalendarDate(date) ||
    typeof reason !== "string" ||
    reason.trim().length < 2 ||
    !isTimestamp(createdAt)
  ) {
    return null;
  }
  return { id, resourceId, date, reason, createdAt };
}

export function parseResourceClosures(value: unknown): ResourceClosure[] | null {
  if (!Array.isArray(value)) return null;
  const closures = value.map(parseResourceClosure);
  return closures.every((closure): closure is ResourceClosure => closure !== null)
    ? closures
    : null;
}

export function parseResourcePage(value: unknown): ResourcePage | null {
  if (!isRecord(value)) return null;
  const { items, total, page, pageSize, totalPages } = value;
  const parsedItems = parseResources(items);

  if (
    !parsedItems ||
    !Number.isInteger(total) ||
    (total as number) < 0 ||
    !Number.isInteger(page) ||
    (page as number) < 1 ||
    !Number.isInteger(pageSize) ||
    (pageSize as number) < 1 ||
    (pageSize as number) > 24 ||
    !Number.isInteger(totalPages) ||
    (totalPages as number) < 0 ||
    (totalPages as number) !==
      Math.ceil((total as number) / (pageSize as number)) ||
    parsedItems.length > (pageSize as number) ||
    parsedItems.length > (total as number) ||
    ((total as number) === 0 && parsedItems.length !== 0) ||
    ((totalPages as number) > 0 && (page as number) > (totalPages as number))
  ) {
    return null;
  }

  return {
    items: parsedItems,
    total: total as number,
    page: page as number,
    pageSize: pageSize as number,
    totalPages: totalPages as number,
  };
}
