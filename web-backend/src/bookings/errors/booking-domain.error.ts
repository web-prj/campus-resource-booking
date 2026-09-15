export type BookingErrorCode =
  | 'INVALID_BOOKING_DATE'
  | 'INVALID_BOOKING_RANGE'
  | 'BOOKING_IN_PAST'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'BOOKING_OVERLAP';

export class BookingDomainError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingDomainError';
  }
}
