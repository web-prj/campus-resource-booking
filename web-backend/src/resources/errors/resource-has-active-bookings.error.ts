import { BookingStatus } from '../../bookings/enums/booking-status.enum';

export const RESOURCE_HAS_ACTIVE_BOOKINGS = 'RESOURCE_HAS_ACTIVE_BOOKINGS';

/** At most this many conflicting bookings are listed in the error. */
export const MAX_LISTED_CONFLICTS = 10;

export interface ConflictingBookingSummary {
  id: string;
  date: string;
  /** `HH:MM` campus time. */
  startTime: string;
  /** `HH:MM` campus time. */
  endTime: string;
  status: BookingStatus;
}

/**
 * A resource change would strand bookings that are still active. The caller
 * must cancel, reject, or complete them first.
 */
export class ResourceHasActiveBookingsError extends Error {
  readonly code = RESOURCE_HAS_ACTIVE_BOOKINGS;

  constructor(
    message: string,
    readonly conflictCount: number,
    readonly conflictingBookings: ConflictingBookingSummary[],
  ) {
    super(message);
    this.name = 'ResourceHasActiveBookingsError';
  }
}
