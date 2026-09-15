import { ApiProperty } from '@nestjs/swagger';
import { CAMPUS_TIME_ZONE } from '../../resources/dto/resource-availability-query.dto';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ format: 'uuid' })
  requesterId: string;

  @ApiProperty({ example: '2026-09-16' })
  date: string;

  @ApiProperty({ example: '09:00' })
  startTime: string;

  @ApiProperty({ example: '10:00' })
  endTime: string;

  @ApiProperty({ example: CAMPUS_TIME_ZONE })
  timeZone: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(booking: Booking): BookingResponseDto {
    return {
      id: booking.id,
      resourceId: booking.resourceId,
      requesterId: booking.requesterId,
      date: booking.date,
      startTime: booking.startTime.slice(0, 5),
      endTime: booking.endTime.slice(0, 5),
      timeZone: CAMPUS_TIME_ZONE,
      status: booking.status,
      createdAt: booking.createdAt,
    };
  }
}
