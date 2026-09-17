export type BookingErrorCode =
  | 'INVALID_BOOKING_DATE'
  | 'INVALID_BOOKING_RANGE'
  | 'BOOKING_IN_PAST'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'BOOKING_OVERLAP'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_CANCELLABLE'
  | 'BOOKING_NOT_PENDING'
  | 'BOOKING_REVIEW_WINDOW_ENDED'
  | 'CHECK_IN_NOT_AVAILABLE'
  | 'CHECK_IN_ALREADY_REQUESTED'
  | 'INVALID_CHECK_IN_CODE'
  | 'BOOKING_NOT_CHECKED_IN'
  | 'NO_SHOW_NOT_AVAILABLE';

export class BookingDomainError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingDomainError';
  }
}
