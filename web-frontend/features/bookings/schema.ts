import type {
  BookingRequestInput,
  BookingRequestResult,
  BookingStatus,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;
const STATUSES: ReadonlySet<BookingStatus> = new Set(["pending", "confirmed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

export function parseBookingRequestResult(
  value: unknown,
  input: BookingRequestInput,
  requesterId: string,
): BookingRequestResult | null {
  if (!isRecord(value)) return null;
  const {
    id,
    resourceId,
    requesterId: responseRequesterId,
    date,
    startTime,
    endTime,
    timeZone,
    status,
    createdAt,
  } = value;

  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    resourceId !== input.resourceId ||
    responseRequesterId !== requesterId ||
    date !== input.date ||
    startTime !== input.startTime ||
    endTime !== input.endTime ||
    !isCalendarDate(date) ||
    typeof startTime !== "string" ||
    !HOUR_PATTERN.test(startTime) ||
    typeof endTime !== "string" ||
    !HOUR_PATTERN.test(endTime) ||
    startTime >= endTime ||
    timeZone !== "Asia/Ho_Chi_Minh" ||
    typeof status !== "string" ||
    !STATUSES.has(status as BookingStatus) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    resourceId,
    requesterId: responseRequesterId as string,
    date,
    startTime,
    endTime,
    timeZone,
    status: status as BookingStatus,
    createdAt,
  };
}
