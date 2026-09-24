import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import {
  MAX_LISTED_CONFLICTS,
  RESOURCE_HAS_ACTIVE_BOOKINGS,
} from '../errors/resource-has-active-bookings.error';

export class ConflictingBookingDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-10-01' })
  date: string;

  @ApiProperty({ example: '09:00' })
  startTime: string;

  @ApiProperty({ example: '10:00' })
  endTime: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;
}

export class ResourceActiveBookingsConflictDto {
  @ApiProperty({ enum: [RESOURCE_HAS_ACTIVE_BOOKINGS] })
  code: typeof RESOURCE_HAS_ACTIVE_BOOKINGS;

  @ApiProperty({
    example:
      'Resolve 3 active bookings before closing this resource on 2026-10-01.',
  })
  message: string;

  @ApiProperty({ description: 'Total conflicting bookings', example: 3 })
  conflictCount: number;

  @ApiProperty({
    type: ConflictingBookingDto,
    isArray: true,
    description: `Up to ${MAX_LISTED_CONFLICTS} conflicts ordered by date and start time`,
  })
  conflictingBookings: ConflictingBookingDto[];
}
