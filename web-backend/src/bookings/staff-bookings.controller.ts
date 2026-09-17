import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ResourceAvailabilityQueryDto } from '../resources/dto/resource-availability-query.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { BookingsService } from './bookings.service';
import { ConfirmCheckInDto } from './dto/confirm-check-in.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import {
  StaffBookingQueueResponseDto,
  StaffBookingResponseDto,
  StaffOperationsQueueResponseDto,
  StaffResourceScheduleResponseDto,
} from './dto/staff-booking-response.dto';
import { BookingDomainError } from './errors/booking-domain.error';

@ApiTags('staff bookings')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Staff role required' })
@Roles(UserRole.STAFF)
@Controller('staff/bookings')
export class StaffBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('operations')
  @ApiOperation({ summary: 'List current and overdue operational bookings' })
  @ApiOkResponse({ type: StaffOperationsQueueResponseDto })
  async findOperations(): Promise<StaffOperationsQueueResponseDto> {
    const { bookings, evaluatedAt, campusDate } =
      await this.bookingsService.findOperationsForStaff();
    return {
      items: bookings.map((booking) =>
        this.staffResponse(booking, evaluatedAt),
      ),
      total: bookings.length,
      campusDate,
    };
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending booking requests oldest first' })
  @ApiOkResponse({ type: StaffBookingQueueResponseDto })
  async findPending(): Promise<StaffBookingQueueResponseDto> {
    const { bookings, evaluatedAt } =
      await this.bookingsService.findPendingForStaff();
    return {
      items: bookings.map((booking) =>
        this.staffResponse(booking, evaluatedAt),
      ),
      total: bookings.length,
    };
  }

  @Get('resources/:resourceId/schedule')
  @ApiOperation({ summary: 'View one resource booking schedule by date' })
  @ApiOkResponse({ type: StaffResourceScheduleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date' })
  async findSchedule(
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Query() query: ResourceAvailabilityQueryDto,
  ): Promise<StaffResourceScheduleResponseDto> {
    const { bookings, evaluatedAt } =
      await this.bookingsService.findResourceSchedule(resourceId, query.date);
    return {
      resourceId,
      date: query.date,
      bookings: bookings.map((booking) =>
        this.staffResponse(booking, evaluatedAt),
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'View booking details for staff review' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffBookingResponseDto> {
    const booking = await this.bookingsService.findOneForStaff(id);
    if (!booking) throw new NotFoundException('Booking not found');
    return this.staffResponse(booking);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending booking request' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Booking request is no longer pending' })
  async approve(
    @CurrentUser('id') reviewerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffBookingResponseDto> {
    try {
      return this.staffResponse(
        await this.bookingsService.approve(reviewerId, id),
      );
    } catch (error: unknown) {
      this.mapReviewError(error);
    }
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending booking request with a reason' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid rejection reason' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Booking request is no longer pending' })
  async reject(
    @CurrentUser('id') reviewerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBookingDto,
  ): Promise<StaffBookingResponseDto> {
    try {
      return this.staffResponse(
        await this.bookingsService.reject(reviewerId, id, dto.reason),
      );
    } catch (error: unknown) {
      this.mapReviewError(error);
    }
  }

  @Patch(':id/confirm-check-in')
  @ApiOperation({ summary: 'Confirm student check-in with the six-digit code' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid code format' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({
    description: 'Check-in unavailable or code incorrect',
  })
  async confirmCheckIn(
    @CurrentUser('id') staffId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmCheckInDto,
  ): Promise<StaffBookingResponseDto> {
    try {
      return this.staffResponse(
        await this.bookingsService.confirmCheckIn(staffId, id, dto.code),
      );
    } catch (error: unknown) {
      this.mapLifecycleError(error);
    }
  }

  @Patch(':id/check-out')
  @ApiOperation({ summary: 'Complete checkout for a checked-in booking' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Booking is not checked in' })
  async checkOut(
    @CurrentUser('id') staffId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffBookingResponseDto> {
    try {
      return this.staffResponse(
        await this.bookingsService.checkOut(staffId, id),
      );
    } catch (error: unknown) {
      this.mapLifecycleError(error);
    }
  }

  @Patch(':id/no-show')
  @ApiOperation({ summary: 'Mark an ended unchecked booking as no-show' })
  @ApiOkResponse({ type: StaffBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'No-show cannot be recorded yet' })
  async markNoShow(
    @CurrentUser('id') staffId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffBookingResponseDto> {
    try {
      return this.staffResponse(
        await this.bookingsService.markNoShow(staffId, id),
      );
    } catch (error: unknown) {
      this.mapLifecycleError(error);
    }
  }

  private staffResponse(
    booking: Parameters<typeof StaffBookingResponseDto.fromEntity>[0],
    evaluatedAt: Date = this.bookingsService.currentTime(),
  ): StaffBookingResponseDto {
    return StaffBookingResponseDto.fromEntity(booking, {
      canReview: this.bookingsService.canReview(booking, evaluatedAt),
      canConfirmCheckIn: this.bookingsService.canConfirmCheckIn(
        booking,
        evaluatedAt,
      ),
      canCheckOut: this.bookingsService.canCheckOut(booking),
      canMarkNoShow: this.bookingsService.canMarkNoShow(booking, evaluatedAt),
    });
  }

  private mapLifecycleError(error: unknown): never {
    if (error instanceof BookingDomainError) {
      const body = { code: error.code, message: error.message };
      if (error.code === 'BOOKING_NOT_FOUND') {
        throw new NotFoundException(body);
      }
      if (
        error.code === 'CHECK_IN_NOT_AVAILABLE' ||
        error.code === 'INVALID_CHECK_IN_CODE' ||
        error.code === 'BOOKING_NOT_CHECKED_IN' ||
        error.code === 'NO_SHOW_NOT_AVAILABLE'
      ) {
        throw new ConflictException(body);
      }
    }
    throw error;
  }

  private mapReviewError(error: unknown): never {
    if (error instanceof BookingDomainError) {
      const body = { code: error.code, message: error.message };
      if (error.code === 'BOOKING_NOT_FOUND') {
        throw new NotFoundException(body);
      }
      if (
        error.code === 'BOOKING_NOT_PENDING' ||
        error.code === 'BOOKING_REVIEW_WINDOW_ENDED'
      ) {
        throw new ConflictException(body);
      }
    }
    throw error;
  }
}
