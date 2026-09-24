import { describe, expect, it } from "vitest";
import {
  parseBookingRequestResult,
  parseStaffBooking,
  parseStaffBookingQueue,
  parseStaffOperationsQueue,
  parseStaffResourceSchedule,
  parseStudentBooking,
  parseStudentBookingTimeline,
} from "./schema";

const requesterId = "30000000-0000-4000-8000-000000000001";
const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};
const result = {
  id: "40000000-0000-4000-8000-000000000001",
  requesterId,
  ...input,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
};

const studentBooking = {
  id: "50000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  canCancel: true,
  canRequestCheckIn: false,
  hasEnded: false,
  checkInCode: null,
  checkInRequestedAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  cancelledAt: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  resource: {
    id: input.resourceId,
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room",
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

const staffBooking = {
  id: "60000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "pending",
  createdAt: "2026-09-15T00:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  canReview: true,
  checkInRequested: false,
  canConfirmCheckIn: false,
  canCheckOut: false,
  canMarkNoShow: false,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  resource: studentBooking.resource,
  requester: {
    id: requesterId,
    email: "student@usth.edu.vn",
    fullName: "Campus Student",
  },
  reviewer: null,
};

describe("staff booking schema", () => {
  it("accepts an actionable pending request and an elapsed read-only request", () => {
    expect(parseStaffBooking(staffBooking)).toEqual(staffBooking);
    expect(parseStaffBooking({ ...staffBooking, canReview: false })).toEqual({
      ...staffBooking,
      canReview: false,
    });
  });

  it.each([
    { ...staffBooking, reviewedAt: "2026-09-15T01:00:00.000Z" },
    {
      ...staffBooking,
      status: "confirmed",
      canReview: true,
      reviewedAt: "2026-09-15T01:00:00.000Z",
      reviewer: {
        id: "30000000-0000-4000-8000-000000000009",
        email: "staff@usth.edu.vn",
        fullName: "Campus Staff",
      },
    },
    {
      ...staffBooking,
      status: "rejected",
      canReview: false,
      reviewedAt: "2026-09-15T01:00:00.000Z",
      reviewer: null,
      rejectionReason: "Schedule conflict",
    },
    { ...staffBooking, rejectionReason: "x" },
  ])("rejects inconsistent review metadata", (value) => {
    expect(parseStaffBooking(value)).toBeNull();
  });

  it("rejects duplicate and unstable queue or schedule data", () => {
    const later = {
      ...staffBooking,
      id: "60000000-0000-4000-8000-000000000002",
      startTime: "10:00",
      endTime: "11:00",
      createdAt: "2026-09-15T01:00:00.000Z",
    };
    expect(
      parseStaffBookingQueue({ items: [staffBooking, staffBooking], total: 2, page: 1, pageSize: 20, totalPages: 1 }),
    ).toBeNull();
    expect(
      parseStaffBookingQueue({ items: [later, staffBooking], total: 2, page: 1, pageSize: 20, totalPages: 1 }),
    ).toBeNull();
    expect(
      parseStaffResourceSchedule(
        {
          resourceId: staffBooking.resource.id,
          date: staffBooking.date,
          bookings: [later, staffBooking],
        },
        staffBooking.resource.id,
        staffBooking.date,
      ),
    ).toBeNull();

    const previousDate = {
      ...later,
      date: "2099-01-04",
      status: "confirmed",
      canReview: false,
    };
    const currentDate = {
      ...later,
      id: "60000000-0000-4000-8000-000000000003",
      status: "confirmed",
      canReview: false,
    };
    expect(
      parseStaffOperationsQueue({
        items: [currentDate, previousDate],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        campusDate: "2099-01-05",
      }),
    ).toBeNull();
    expect(
      parseStaffOperationsQueue({
        items: [previousDate, currentDate],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        campusDate: "2099-01-05",
      }),
    ).toEqual({
      items: [previousDate, currentDate],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      campusDate: "2099-01-05",
    });
    expect(
      parseStaffOperationsQueue({
        items: [{ ...currentDate, date: "2099-01-06" }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        campusDate: "2099-01-05",
      }),
    ).toBeNull();
  });

  it("validates queue page metadata against the items on the page", () => {
    const page = { page: 2, pageSize: 20, totalPages: 2 };
    expect(
      parseStaffBookingQueue({ items: [staffBooking], total: 21, ...page }),
    ).toEqual({ items: [staffBooking], total: 21, ...page });
    expect(
      parseStaffBookingQueue({ items: [], total: 21, page: 3, pageSize: 20, totalPages: 2 }),
    ).toEqual({ items: [], total: 21, page: 3, pageSize: 20, totalPages: 2 });
    expect(
      parseStaffBookingQueue({ items: [staffBooking], total: 1, page: 1, pageSize: 20, totalPages: 3 }),
    ).toBeNull();
    expect(
      parseStaffBookingQueue({ items: [staffBooking], total: 22, ...page }),
    ).toBeNull();
    expect(
      parseStaffBookingQueue({ items: [staffBooking], total: 1, page: 1, pageSize: 51, totalPages: 1 }),
    ).toBeNull();
    expect(parseStaffBookingQueue({ items: [staffBooking], total: 1 })).toBeNull();
  });
});

describe("booking response schema", () => {
  it.each(["confirmed", "pending"] as const)(
    "parses a scoped %s booking response",
    (status) => {
      expect(
        parseBookingRequestResult({ ...result, status }, input, requesterId),
      ).toEqual({ ...result, status });
    },
  );

  it.each([
    { ...result, id: "bad" },
    { ...result, resourceId: "20000000-0000-4000-8000-000000000002" },
    { ...result, requesterId: "30000000-0000-4000-8000-000000000002" },
    { ...result, date: "2099-01-06" },
    { ...result, startTime: "10:00" },
    { ...result, endTime: "11:00" },
    { ...result, status: "cancelled" },
    { ...result, timeZone: "UTC" },
    { ...result, createdAt: "bad" },
  ])("rejects malformed or out-of-scope booking data", (value) => {
    expect(parseBookingRequestResult(value, input, requesterId)).toBeNull();
  });
});

describe("student booking timeline schema", () => {
  it("accepts consumed codes only in terminal check-in lifecycle states", () => {
    const requestedAt = "2099-01-05T01:50:00.000Z";
    const checkedInAt = "2099-01-05T02:00:00.000Z";
    const checkedIn = {
      ...studentBooking,
      status: "checked_in",
      canCancel: false,
      checkInRequestedAt: requestedAt,
      checkedInAt,
    };
    expect(parseStudentBooking(checkedIn)).toEqual(checkedIn);
    expect(
      parseStudentBooking({ ...checkedIn, checkInCode: "482193" }),
    ).toBeNull();
    expect(
      parseStudentBooking({
        ...checkedIn,
        status: "completed",
        checkedOutAt: "2099-01-05T01:59:59.000Z",
      }),
    ).toBeNull();
    expect(
      parseStudentBooking({
        ...studentBooking,
        status: "no_show",
        canCancel: false,
        hasEnded: true,
        checkInRequestedAt: requestedAt,
        noShowAt: "2099-01-05T02:59:59.000Z",
      }),
    ).toBeNull();
  });

  it.each(["pending", "confirmed", "checked_in"] as const)(
    "accepts an ended %s booking in authoritative history",
    (status) => {
      const historical = {
        ...studentBooking,
        status,
        canCancel: false,
        hasEnded: true,
        ...(status === "checked_in"
          ? {
              checkInRequestedAt: "2099-01-05T01:50:00.000Z",
              checkedInAt: "2099-01-05T02:00:00.000Z",
            }
          : {}),
      };

      expect(
        parseStudentBookingTimeline({ upcoming: [], history: [historical] }),
      ).toEqual({ upcoming: [], history: [historical] });
    },
  );

  it("rejects terminal statuses in upcoming, duplicate IDs, and unstable ordering", () => {
    const cancelled = {
      ...studentBooking,
      status: "cancelled",
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    expect(
      parseStudentBookingTimeline({ upcoming: [cancelled], history: [] }),
    ).toBeNull();
    expect(
      parseStudentBookingTimeline({
        upcoming: [studentBooking],
        history: [{ ...studentBooking, canCancel: false, hasEnded: true }],
      }),
    ).toBeNull();
    expect(
      parseStudentBookingTimeline({
        upcoming: [
          { ...studentBooking, date: "2099-01-06" },
          {
            ...studentBooking,
            id: "50000000-0000-4000-8000-000000000002",
          },
        ],
        history: [],
      }),
    ).toBeNull();
    expect(
      parseStudentBookingTimeline({
        upcoming: [],
        history: [
          { ...studentBooking, canCancel: false, hasEnded: true },
          {
            ...studentBooking,
            id: "50000000-0000-4000-8000-000000000002",
            date: "2099-01-06",
            canCancel: false,
            hasEnded: true,
          },
        ],
      }),
    ).toBeNull();
  });
});
