import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CAMPUS_TIME_ZONE } from '../../resources/dto/resource-availability-query.dto';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { StudentBookingResourceDto } from './student-booking-response.dto';

export class StaffBookingRequesterDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'student@usth.edu.vn' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  static fromEntity(user: User): StaffBookingRequesterDto {
    return { id: user.id, email: user.email, fullName: user.fullName };
  }
}

export class StaffBookingReviewerDto extends StaffBookingRequesterDto {}

export class StaffBookingResponseDto {
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

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  rejectionReason: string | null;

  @ApiProperty({ description: 'Whether staff can review this request now' })
  canReview: boolean;

  @ApiProperty({ description: 'Whether the student has generated a code' })
  checkInRequested: boolean;

  @ApiProperty({ description: 'Whether staff can confirm check-in now' })
  canConfirmCheckIn: boolean;

  @ApiProperty({ description: 'Whether staff can complete check-out' })
  canCheckOut: boolean;

  @ApiProperty({ description: 'Whether staff can record a no-show' })
  canMarkNoShow: boolean;

  @ApiPropertyOptional({ nullable: true })
  checkedInAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  checkedOutAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  noShowAt: Date | null;

  @ApiProperty({ type: StudentBookingResourceDto })
  resource: StudentBookingResourceDto;

  @ApiProperty({ type: StaffBookingRequesterDto })
  requester: StaffBookingRequesterDto;

  @ApiPropertyOptional({ type: StaffBookingReviewerDto, nullable: true })
  reviewer: StaffBookingReviewerDto | null;

  static fromEntity(
    booking: Booking,
    actions: {
      canReview: boolean;
      canConfirmCheckIn: boolean;
      canCheckOut: boolean;
      canMarkNoShow: boolean;
    },
  ): StaffBookingResponseDto {
    return {
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime.slice(0, 5),
      endTime: booking.endTime.slice(0, 5),
      timeZone: CAMPUS_TIME_ZONE,
      status: booking.status,
      createdAt: booking.createdAt,
      reviewedAt: booking.reviewedAt,
      rejectionReason: booking.rejectionReason,
      canReview: actions.canReview,
      checkInRequested: booking.checkInRequestedAt !== null,
      canConfirmCheckIn: actions.canConfirmCheckIn,
      canCheckOut: actions.canCheckOut,
      canMarkNoShow: actions.canMarkNoShow,
      checkedInAt: booking.checkedInAt,
      checkedOutAt: booking.checkedOutAt,
      noShowAt: booking.noShowAt,
      resource: StudentBookingResourceDto.fromEntity(booking.resource),
      requester: StaffBookingRequesterDto.fromEntity(booking.requester),
      reviewer: booking.reviewer
        ? StaffBookingRequesterDto.fromEntity(booking.reviewer)
        : null,
    };
  }
}

export class StaffBookingQueueResponseDto {
  @ApiProperty({ type: StaffBookingResponseDto, isArray: true })
  items: StaffBookingResponseDto[];

  @ApiProperty({
    description: 'Total reviewable pending requests across all pages',
    example: 42,
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class StaffOperationsQueueResponseDto {
  @ApiProperty({ type: StaffBookingResponseDto, isArray: true })
  items: StaffBookingResponseDto[];

  @ApiProperty({
    description:
      'Total current or overdue operational bookings across all pages',
    example: 42,
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({
    description: 'Campus date used to scope and label this operations snapshot',
    example: '2026-09-16',
  })
  campusDate: string;
}

export class StaffResourceScheduleResponseDto {
  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ example: '2026-09-16' })
  date: string;

  @ApiProperty({ type: StaffBookingResponseDto, isArray: true })
  bookings: StaffBookingResponseDto[];
}
