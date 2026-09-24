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

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isAtOrAfter(left: string | null, right: string | null): boolean {
  return (
    left === null ||
    right === null ||
    new Date(left).getTime() >= new Date(right).getTime()
  );
}

function campusBookingEndMs(date: string, endTime: string): number {
  return new Date(`${date}T${endTime}:00+07:00`).getTime();
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
    (checkInRequestedAt !== null && !isValidTimestamp(checkInRequestedAt)) ||
    (checkedInAt !== null && !isValidTimestamp(checkedInAt)) ||
    (checkedOutAt !== null && !isValidTimestamp(checkedOutAt)) ||
    (noShowAt !== null && !isValidTimestamp(noShowAt)) ||
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
    (checkInRequestedAt === null
      ? checkInCode !== null ||
        status === "checked_in" ||
        status === "completed"
      : status === "confirmed"
        ? checkInCode === null
        : !["checked_in", "completed", "no_show"].includes(status) ||
          checkInCode !== null) ||
    (status === "checked_in"
      ? checkedInAt === null ||
        checkInRequestedAt === null ||
        checkedOutAt !== null ||
        noShowAt !== null
      : status === "completed"
        ? checkedInAt === null ||
          checkInRequestedAt === null ||
          checkedOutAt === null ||
          noShowAt !== null
        : status === "no_show"
          ? noShowAt === null || checkedInAt !== null || checkedOutAt !== null
          : checkedInAt !== null || checkedOutAt !== null || noShowAt !== null) ||
    !isAtOrAfter(checkedInAt, checkInRequestedAt) ||
    !isAtOrAfter(checkedOutAt, checkedInAt) ||
    (noShowAt !== null &&
      new Date(noShowAt).getTime() < campusBookingEndMs(date, endTime)) ||
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
    (checkedInAt !== null && !isValidTimestamp(checkedInAt)) ||
    (checkedOutAt !== null && !isValidTimestamp(checkedOutAt)) ||
    (noShowAt !== null && !isValidTimestamp(noShowAt)) ||
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
      ? checkedInAt === null ||
        !checkInRequested ||
        checkedOutAt !== null ||
        noShowAt !== null
      : status === "completed"
        ? checkedInAt === null ||
          !checkInRequested ||
          checkedOutAt === null ||
          noShowAt !== null
        : status === "no_show"
          ? noShowAt === null || checkedInAt !== null || checkedOutAt !== null
          : checkedInAt !== null || checkedOutAt !== null || noShowAt !== null) ||
    !isAtOrAfter(checkedOutAt, checkedInAt) ||
    (noShowAt !== null &&
      new Date(noShowAt).getTime() < campusBookingEndMs(date, endTime)) ||
    (canConfirmCheckIn &&
      (status !== "confirmed" || !checkInRequested)) ||
    (canConfirmCheckIn && canMarkNoShow) ||
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

interface StaffQueuePage {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function parseStaffQueuePage(
  value: Record<string, unknown>,
  itemCount: number,
): StaffQueuePage | null {
  const { total, page, pageSize, totalPages } = value;
  if (
    typeof total !== "number" ||
    !Number.isInteger(total) ||
    total < 0 ||
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    typeof totalPages !== "number" ||
    totalPages !== Math.ceil(total / pageSize)
  ) {
    return null;
  }
  const offset = (page - 1) * pageSize;
  const expectedItems = offset >= total ? 0 : Math.min(pageSize, total - offset);
  if (itemCount !== expectedItems) return null;
  return { total, page, pageSize, totalPages };
}

export function parseStaffBookingQueue(value: unknown): StaffBookingQueue | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items = value.items.map(parseStaffBooking);
  const pageInfo = parseStaffQueuePage(value, items.length);
  if (
    !pageInfo ||
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
  return { items: items as StaffBooking[], ...pageInfo };
}

export function parseStaffOperationsQueue(
  value: unknown,
): StaffOperationsQueue | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isCalendarDate(value.campusDate)
  ) {
    return null;
  }

  const campusDate = value.campusDate;
  const items = value.items.map(parseStaffBooking);
  const pageInfo = parseStaffQueuePage(value, items.length);
  if (
    !pageInfo ||
    items.some(
      (booking) =>
        booking === null ||
        booking.date > campusDate ||
        (booking.status !== "confirmed" && booking.status !== "checked_in"),
    ) ||
    !hasUniqueStaffBookingIds(items) ||
    !isStaffBookingOrderStable(
      items,
      (booking) => `${booking.date}:${booking.startTime}:${booking.createdAt}`,
    )
  ) {
    return null;
  }
  return {
    items: items as StaffBooking[],
    ...pageInfo,
    campusDate,
  };
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
