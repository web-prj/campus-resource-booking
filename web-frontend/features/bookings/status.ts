import type { BookingStatus, StudentBooking } from "./types";

export type StudentBookingDisplayStatus = BookingStatus | "expired";

export const studentStatusLabels: Record<StudentBookingDisplayStatus, string> = {
  pending: "Pending approval",
  expired: "Expired request",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * A pending request whose scheduled time has ended was never reviewed. The
 * backend keeps it as `pending`, so the interface presents it as expired
 * instead of implying that a decision is still coming.
 */
export function isExpiredRequest(
  booking: Pick<StudentBooking, "status" | "hasEnded">,
): boolean {
  return booking.status === "pending" && booking.hasEnded;
}

export function studentDisplayStatus(
  booking: Pick<StudentBooking, "status" | "hasEnded">,
): StudentBookingDisplayStatus {
  return isExpiredRequest(booking) ? "expired" : booking.status;
}

export function studentStatusLabel(
  booking: Pick<StudentBooking, "status" | "hasEnded">,
): string {
  return studentStatusLabels[studentDisplayStatus(booking)];
}
