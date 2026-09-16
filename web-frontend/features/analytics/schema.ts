import type { BookingStatus } from "@/features/bookings/types";
import type {
  AnalyticsStatus,
  AnalyticsSummary,
  PeakHour,
  PopularResource,
} from "./types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
  "rejected",
  "cancelled",
];
const STATUS_SET = new Set<string>(STATUSES);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function rate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseStatus(value: unknown): AnalyticsStatus | null {
  if (!record(value)) return null;
  const { status, count: total, percentage: share } = value;
  return typeof status === "string" && STATUS_SET.has(status) && count(total) && rate(share)
    ? { status: status as BookingStatus, count: total, percentage: share }
    : null;
}

function parseResource(value: unknown): PopularResource | null {
  if (!record(value)) return null;
  const { id, code, name, building, bookingCount, bookedHours } = value;
  return typeof id === "string" && UUID.test(id) && typeof code === "string" && code.length > 0 &&
    typeof name === "string" && name.length > 0 && typeof building === "string" && building.length > 0 &&
    count(bookingCount) && bookingCount > 0 && count(bookedHours) && bookedHours > 0
    ? { id, code, name, building, bookingCount, bookedHours }
    : null;
}

function parsePeak(value: unknown): PeakHour | null {
  if (!record(value)) return null;
  const { hour, label, bookingCount } = value;
  return count(hour) && hour <= 22 && label === `${String(hour).padStart(2, "0")}:00` &&
    count(bookingCount) && bookingCount > 0
    ? { hour, label, bookingCount }
    : null;
}

export function parseAnalyticsSummary(value: unknown): AnalyticsSummary | null {
  if (!record(value)) return null;
  const {
    from, to, timeZone, totalBookings, cancelledBookings, cancellationRate,
    scheduledHours, capacityHours, utilizationRate, resourcesRepresented,
    statuses, popularResources, peakHours, definition,
  } = value;
  if (
    !validDate(from) || !validDate(to) || from > to || timeZone !== "Asia/Ho_Chi_Minh" ||
    !count(totalBookings) || !count(cancelledBookings) || cancelledBookings > totalBookings ||
    !rate(cancellationRate) || cancellationRate !== percentage(cancelledBookings, totalBookings) ||
    !count(scheduledHours) || !count(capacityHours) ||
    (utilizationRate !== null && !nonNegative(utilizationRate)) ||
    (capacityHours === 0 ? scheduledHours !== 0 || utilizationRate !== null : utilizationRate !== percentage(scheduledHours, capacityHours)) ||
    !count(resourcesRepresented) || !Array.isArray(statuses) || !Array.isArray(popularResources) ||
    !Array.isArray(peakHours) || typeof definition !== "string" || definition.length < 40
  ) return null;

  const parsedStatuses = statuses.map(parseStatus);
  const parsedResources = popularResources.map(parseResource);
  const parsedPeaks = peakHours.map(parsePeak);
  if (
    parsedStatuses.some((item) => item === null) || parsedStatuses.length !== STATUSES.length ||
    new Set(parsedStatuses.map((item) => item?.status)).size !== STATUSES.length ||
    parsedStatuses.reduce((sum, item) => sum + (item?.count ?? 0), 0) !== totalBookings ||
    parsedStatuses.some((item) => item!.percentage !== percentage(item!.count, totalBookings)) ||
    parsedStatuses.find((item) => item!.status === "cancelled")!.count !== cancelledBookings ||
    parsedResources.some((item) => item === null) || parsedResources.length > 5 ||
    parsedResources.length !== Math.min(resourcesRepresented, 5) ||
    parsedResources.some((item) => item!.bookingCount > totalBookings) ||
    parsedResources.some((item, index) => index > 0 && item!.bookingCount > parsedResources[index - 1]!.bookingCount) ||
    parsedPeaks.some((item) => item === null) ||
    parsedPeaks.some((item, index) => index > 0 && item!.hour <= parsedPeaks[index - 1]!.hour) ||
    parsedPeaks.some((item) => item!.bookingCount > totalBookings)
  ) return null;

  return {
    from, to, timeZone, totalBookings, cancelledBookings, cancellationRate,
    scheduledHours, capacityHours, utilizationRate, resourcesRepresented,
    statuses: parsedStatuses as AnalyticsStatus[],
    popularResources: parsedResources as PopularResource[],
    peakHours: parsedPeaks as PeakHour[], definition,
  };
}
