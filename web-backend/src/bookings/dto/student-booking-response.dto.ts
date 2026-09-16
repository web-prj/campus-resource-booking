import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CAMPUS_TIME_ZONE } from '../../resources/dto/resource-availability-query.dto';
import { Resource } from '../../resources/entities/resource.entity';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';

export class StudentBookingResourceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ROOM-A101' })
  code: string;

  @ApiProperty({ example: 'Study Room A101' })
  name: string;

  @ApiProperty({ example: 'room' })
  type: string;

  @ApiProperty({ example: 'First floor' })
  location: string;

  @ApiProperty({ example: 'MAIN' })
  buildingCode: string;

  @ApiProperty({ example: 'Main Academic Building' })
  buildingName: string;

  static fromEntity(resource: Resource): StudentBookingResourceDto {
    return {
      id: resource.id,
      code: resource.code,
      name: resource.name,
      type: resource.type,
      location: resource.location,
      buildingCode: resource.building.code,
      buildingName: resource.building.name,
    };
  }
}

export class StudentBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

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

  @ApiProperty({
    description: 'True only while the booking can still be cancelled',
  })
  canCancel: boolean;

  @ApiProperty({ description: 'True while the student may generate a code' })
  canRequestCheckIn: boolean;

  @ApiPropertyOptional({ nullable: true, example: '482193' })
  checkInCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  checkInRequestedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  checkedInAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  checkedOutAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  noShowAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  rejectionReason: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: StudentBookingResourceDto })
  resource: StudentBookingResourceDto;

  static fromEntity(
    booking: Booking,
    canCancel: boolean,
    canRequestCheckIn: boolean,
  ): StudentBookingResponseDto {
    return {
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime.slice(0, 5),
      endTime: booking.endTime.slice(0, 5),
      timeZone: CAMPUS_TIME_ZONE,
      status: booking.status,
      canCancel,
      canRequestCheckIn,
      checkInCode: booking.checkInCode,
      checkInRequestedAt: booking.checkInRequestedAt,
      checkedInAt: booking.checkedInAt,
      checkedOutAt: booking.checkedOutAt,
      noShowAt: booking.noShowAt,
      cancelledAt: booking.cancelledAt,
      reviewedAt: booking.reviewedAt,
      rejectionReason: booking.rejectionReason,
      createdAt: booking.createdAt,
      resource: StudentBookingResourceDto.fromEntity(booking.resource),
    };
  }
}

export class StudentBookingListResponseDto {
  @ApiProperty({ type: StudentBookingResponseDto, isArray: true })
  upcoming: StudentBookingResponseDto[];

  @ApiProperty({ type: StudentBookingResponseDto, isArray: true })
  history: StudentBookingResponseDto[];
}
