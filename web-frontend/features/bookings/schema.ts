import type {
  ActiveBookingStatus,
  BookingRequestInput,
  BookingRequestResult,
  BookingResourceSummary,
  BookingStatus,
  StaffBooking,
  StaffBookingPerson,
  StaffBookingQueue,
  StaffOperationsQueue,
  StaffResourceSchedule,
  StudentBooking,
  StudentBookingTimeline,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;
const STATUSES: ReadonlySet<BookingStatus> = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
  "rejected",
  "cancelled",
]);
const ACTIVE_STATUSES: ReadonlySet<ActiveBookingStatus> = new Set([
  "pending",
  "confirmed",
]);

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

function parseBookingResource(value: unknown): BookingResourceSummary | null {
  if (!isRecord(value)) return null;
  const { id, code, name, type, location, buildingCode, buildingName } = value;
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof code !== "string" ||
    typeof name !== "string" ||
    (type !== "room" && type !== "laboratory" && type !== "equipment") ||
    typeof location !== "string" ||
    typeof buildingCode !== "string" ||
    typeof buildingName !== "string"
  ) {
    return null;
  }
  return { id, code, name, type, location, buildingCode, buildingName };
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
    !ACTIVE_STATUSES.has(status as ActiveBookingStatus) ||
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
    status: status as ActiveBookingStatus,
    createdAt,
  };
}

export function parseStudentBooking(value: unknown): StudentBooking | null {
  if (!isRecord(value)) return null;
  const {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status,
    canCancel,
    canRequestCheckIn,
    hasEnded,
    checkInCode,
    checkInRequestedAt,
    checkedInAt,
    checkedOutAt,
    noShowAt,
    cancelledAt,
    reviewedAt,
    rejectionReason,
    createdAt,
    resource,
  } = value;
  const parsedResource = parseBookingResource(resource);
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    !isCalendarDate(date) ||
    typeof startTime !== "string" ||
    !HOUR_PATTERN.test(startTime) ||
    typeof endTime !== "string" ||
    !HOUR_PATTERN.test(endTime) ||
    startTime >= endTime ||
    timeZone !== "Asia/Ho_Chi_Minh" ||
    typeof status !== "string" ||
    !STATUSES.has(status as BookingStatus) ||
    typeof canCancel !== "boolean" ||
    typeof canRequestCheckIn !== "boolean" ||
    typeof hasEnded !== "boolean" ||
    (checkInCode !== null &&
      (typeof checkInCode !== "string" || !/^\d{6}$/.test(checkInCode))) ||
    (checkInRequestedAt !== null &&
      (typeof checkInRequestedAt !== "string" || Number.isNaN(Date.parse(checkInRequestedAt)))) ||
    (checkedInAt !== null &&
      (typeof checkedInAt !== "string" || Number.isNaN(Date.parse(checkedInAt)))) ||
    (checkedOutAt !== null &&
      (typeof checkedOutAt !== "string" || Number.isNaN(Date.parse(checkedOutAt)))) ||
    (noShowAt !== null &&
      (typeof noShowAt !== "string" || Number.isNaN(Date.parse(noShowAt)))) ||
    (cancelledAt !== null &&
      (typeof cancelledAt !== "string" || Number.isNaN(Date.parse(cancelledAt)))) ||
    (reviewedAt !== null &&
      (typeof reviewedAt !== "string" || Number.isNaN(Date.parse(reviewedAt)))) ||
    (rejectionReason !== null && typeof rejectionReason !== "string") ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt)) ||
    !parsedResource ||
    (status === "cancelled"
      ? canCancel || cancelledAt === null
      : cancelledAt !== null) ||
    (status === "rejected"
      ? canCancel || reviewedAt === null || !rejectionReason
      : rejectionReason !== null) ||
    ((checkInCode === null) !== (checkInRequestedAt === null)) ||
    (status === "checked_in"
      ? checkedInAt === null || checkedOutAt !== null || noShowAt !== null
      : status === "completed"
        ? checkedInAt === null || checkedOutAt === null || noShowAt !== null
        : status === "no_show"
          ? noShowAt === null || checkedInAt !== null || checkedOutAt !== null
          : checkedInAt !== null || checkedOutAt !== null || noShowAt !== null) ||
    (canRequestCheckIn &&
      (status !== "confirmed" || checkInRequestedAt !== null)) ||
    (hasEnded && (canCancel || canRequestCheckIn))
  ) {
    return null;
  }
  return {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status: status as BookingStatus,
    canCancel,
    canRequestCheckIn,
    hasEnded,
    checkInCode,
    checkInRequestedAt,
    checkedInAt,
    checkedOutAt,
    noShowAt,
    cancelledAt,
    reviewedAt,
    rejectionReason,
    createdAt,
    resource: parsedResource,
  };
}

function bookingStart(booking: StudentBooking | null): string {
  return booking ? `${booking.date}T${booking.startTime}` : "";
}

function isChronological(
  bookings: Array<StudentBooking | null>,
  direction: "asc" | "desc",
): boolean {
  return bookings.every((booking, index) => {
    if (index === 0) return true;
    const previous = bookingStart(bookings[index - 1]);
    const current = bookingStart(booking);
    return direction === "asc" ? previous <= current : previous >= current;
  });
}

export function parseStudentBookingTimeline(
  value: unknown,
): StudentBookingTimeline | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.upcoming) ||
    !Array.isArray(value.history)
  ) {
    return null;
  }
  const upcoming = value.upcoming.map(parseStudentBooking);
  const history = value.history.map(parseStudentBooking);
  const bookings = [...upcoming, ...history];
  if (
    upcoming.some(
      (booking) =>
        booking === null ||
        booking.hasEnded ||
        !["pending", "confirmed", "checked_in"].includes(booking.status),
    ) ||
    history.some(
      (booking) =>
        booking === null ||
        (["pending", "confirmed", "checked_in"].includes(booking.status) &&
          !booking.hasEnded),
    ) ||
    new Set(bookings.map((booking) => booking?.id)).size !== bookings.length ||
    !isChronological(upcoming, "asc") ||
    !isChronological(history, "desc")
  ) {
    return null;
  }
  return {
    upcoming: upcoming as StudentBooking[],
    history: history as StudentBooking[],
  };
}

function parseStaffBookingPerson(value: unknown): StaffBookingPerson | null {
  if (!isRecord(value)) return null;
  const { id, email, fullName } = value;
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof email !== "string" ||
    !email.endsWith("@usth.edu.vn") ||
    typeof fullName !== "string" ||
    !fullName
  ) {
    return null;
  }
  return { id, email, fullName };
}

export function parseStaffBooking(value: unknown): StaffBooking | null {
  if (!isRecord(value)) return null;
  const {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status,
    createdAt,
    reviewedAt,
    rejectionReason,
    canReview,
    checkInRequested,
    canConfirmCheckIn,
    canCheckOut,
    canMarkNoShow,
    checkedInAt,
    checkedOutAt,
    noShowAt,
    resource,
    requester,
    reviewer,
  } = value;
  const parsedResource = parseBookingResource(resource);
  const parsedRequester = parseStaffBookingPerson(requester);
  const parsedReviewer = reviewer === null ? null : parseStaffBookingPerson(reviewer);
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
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
    Number.isNaN(Date.parse(createdAt)) ||
    (reviewedAt !== null &&
      (typeof reviewedAt !== "string" || Number.isNaN(Date.parse(reviewedAt)))) ||
    (rejectionReason !== null &&
      (typeof rejectionReason !== "string" ||
        rejectionReason.length < 3 ||
        rejectionReason.length > 500)) ||
    typeof canReview !== "boolean" ||
    typeof checkInRequested !== "boolean" ||
    typeof canConfirmCheckIn !== "boolean" ||
    typeof canCheckOut !== "boolean" ||
    typeof canMarkNoShow !== "boolean" ||
    (checkedInAt !== null &&
      (typeof checkedInAt !== "string" || Number.isNaN(Date.parse(checkedInAt)))) ||
    (checkedOutAt !== null &&
      (typeof checkedOutAt !== "string" || Number.isNaN(Date.parse(checkedOutAt)))) ||
    (noShowAt !== null &&
      (typeof noShowAt !== "string" || Number.isNaN(Date.parse(noShowAt)))) ||
    !parsedResource ||
    !parsedRequester ||
    (reviewer !== null && !parsedReviewer) ||
    ((reviewedAt === null) !== (reviewer === null)) ||
    (status === "pending"
      ? reviewedAt !== null ||
        reviewer !== null ||
        rejectionReason !== null
      : canReview) ||
    (status === "rejected"
      ? reviewedAt === null || reviewer === null || !rejectionReason
      : rejectionReason !== null) ||
    (status === "checked_in"
      ? checkedInAt === null || checkedOutAt !== null || noShowAt !== null
      : status === "completed"
        ? checkedInAt === null || checkedOutAt === null || noShowAt !== null
        : status === "no_show"
          ? noShowAt === null || checkedInAt !== null || checkedOutAt !== null
          : checkedInAt !== null || checkedOutAt !== null || noShowAt !== null) ||
    (canConfirmCheckIn &&
      (status !== "confirmed" || !checkInRequested)) ||
    (canCheckOut !== (status === "checked_in")) ||
    (canMarkNoShow && status !== "confirmed")
  ) {
    return null;
  }
  return {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status: status as BookingStatus,
    createdAt,
    reviewedAt,
    rejectionReason,
    canReview,
    checkInRequested,
    canConfirmCheckIn,
    canCheckOut,
    canMarkNoShow,
    checkedInAt,
    checkedOutAt,
    noShowAt,
    resource: parsedResource,
    requester: parsedRequester,
    reviewer: parsedReviewer,
  };
}

function hasUniqueStaffBookingIds(
  bookings: Array<StaffBooking | null>,
): boolean {
  return new Set(bookings.map((booking) => booking?.id)).size === bookings.length;
}

function isStaffBookingOrderStable(
  bookings: Array<StaffBooking | null>,
  key: (booking: StaffBooking) => string,
): boolean {
  return bookings.every((booking, index) => {
    if (!booking || index === 0) return booking !== null;
    const previous = bookings[index - 1];
    return previous !== null && key(previous) <= key(booking);
  });
}

export function parseStaffBookingQueue(value: unknown): StaffBookingQueue | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.total !== "number") {
    return null;
  }
  const items = value.items.map(parseStaffBooking);
  if (
    value.total !== items.length ||
    items.some(
      (booking) =>
        booking === null ||
        booking.status !== "pending" ||
        !booking.canReview,
    ) ||
    !hasUniqueStaffBookingIds(items) ||
    !isStaffBookingOrderStable(items, (booking) => booking.createdAt)
  ) {
    return null;
  }
  return { items: items as StaffBooking[], total: value.total };
}

export function parseStaffOperationsQueue(
  value: unknown,
): StaffOperationsQueue | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.total !== "number") {
    return null;
  }
  const items = value.items.map(parseStaffBooking);
  if (
    value.total !== items.length ||
    items.some(
      (booking) =>
        booking === null ||
        (booking.status !== "confirmed" && booking.status !== "checked_in"),
    ) ||
    !hasUniqueStaffBookingIds(items) ||
    !isStaffBookingOrderStable(
      items,
      (booking) => `${booking.startTime}:${booking.createdAt}`,
    )
  ) {
    return null;
  }
  return { items: items as StaffBooking[], total: value.total };
}

export function parseStaffResourceSchedule(
  value: unknown,
  resourceId: string,
  date: string,
): StaffResourceSchedule | null {
  if (
    !isRecord(value) ||
    value.resourceId !== resourceId ||
    value.date !== date ||
    !Array.isArray(value.bookings)
  ) {
    return null;
  }
  const bookings = value.bookings.map(parseStaffBooking);
  if (
    bookings.some(
      (booking) =>
        booking === null ||
        booking.resource.id !== resourceId ||
        booking.date !== date,
    ) ||
    !hasUniqueStaffBookingIds(bookings) ||
    !isStaffBookingOrderStable(
      bookings,
      (booking) => `${booking.startTime}:${booking.createdAt}`,
    )
  ) {
    return null;
  }
  return { resourceId, date, bookings: bookings as StaffBooking[] };
}
