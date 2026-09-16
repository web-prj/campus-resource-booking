import { ApiError, browserRequest } from "@/lib/api/browser-client";
import { parseStaffBooking } from "../schema";
import type { StaffBooking } from "../types";

export type StaffBookingActionErrorCode =
  | "validation"
  | "session"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "network"
  | "unexpected";

export class StaffBookingActionError extends Error {
  constructor(public readonly code: StaffBookingActionErrorCode, message: string) {
    super(message);
    this.name = "StaffBookingActionError";
  }
}

function mapError(error: unknown): StaffBookingActionError {
  if (error instanceof StaffBookingActionError) return error;
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return new StaffBookingActionError(
        "network",
        "The approval service is unreachable. Check your connection and try again.",
      );
    }
    const code: StaffBookingActionErrorCode =
      error.status === 400
        ? "validation"
        : error.status === 401
          ? "session"
          : error.status === 403
            ? "forbidden"
            : error.status === 404
              ? "not-found"
              : error.status === 409
                ? "conflict"
                : "unexpected";
    const messages: Record<StaffBookingActionErrorCode, string> = {
      validation: "Enter a clear rejection reason between 3 and 500 characters.",
      session: "Your session has ended. Sign in again before reviewing requests.",
      forbidden: "Only staff accounts can review booking requests.",
      "not-found": "This booking request no longer exists.",
      conflict: "This request has already been reviewed. Refresh its details.",
      network:
        "The approval service is unreachable. Check your connection and try again.",
      unexpected: "This review could not be saved. Try again.",
    };
    return new StaffBookingActionError(code, messages[code]);
  }
  return new StaffBookingActionError(
    "unexpected",
    "This review could not be saved. Try again.",
  );
}

async function reviewBooking(
  id: string,
  action: "approve" | "reject",
  reason?: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  try {
    const booking = parseStaffBooking(
      await browserRequest(
        `/staff/bookings/${id}/${action}`,
        {
          method: "PATCH",
          body: reason === undefined ? undefined : JSON.stringify({ reason }),
        },
        request,
      ),
    );
    const expectedStatus = action === "approve" ? "confirmed" : "rejected";
    if (!booking || booking.id !== id || booking.status !== expectedStatus) {
      throw new StaffBookingActionError(
        "unexpected",
        "The approval service returned invalid booking data.",
      );
    }
    return booking;
  } catch (error) {
    throw mapError(error);
  }
}

export function confirmStaffCheckIn(
  id: string,
  code: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  return lifecycleBooking(id, "confirm-check-in", "checked_in", { code }, request);
}

export function checkOutStaffBooking(
  id: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  return lifecycleBooking(id, "check-out", "completed", undefined, request);
}

export function markStaffBookingNoShow(
  id: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  return lifecycleBooking(id, "no-show", "no_show", undefined, request);
}

async function lifecycleBooking(
  id: string,
  action: "confirm-check-in" | "check-out" | "no-show",
  expectedStatus: "checked_in" | "completed" | "no_show",
  body: { code: string } | undefined,
  request: typeof fetch,
): Promise<StaffBooking> {
  try {
    const booking = parseStaffBooking(
      await browserRequest(
        `/staff/bookings/${id}/${action}`,
        {
          method: "PATCH",
          body: body ? JSON.stringify(body) : undefined,
        },
        request,
      ),
    );
    if (!booking || booking.id !== id || booking.status !== expectedStatus) {
      throw new StaffBookingActionError(
        "unexpected",
        "The operations service returned invalid booking data.",
      );
    }
    return booking;
  } catch (error) {
    throw mapError(error);
  }
}

export function approveStaffBooking(
  id: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  return reviewBooking(id, "approve", undefined, request);
}

export function rejectStaffBooking(
  id: string,
  reason: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking> {
  return reviewBooking(id, "reject", reason, request);
}
