import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  StudentBookingListResponseDto,
  StudentBookingResponseDto,
} from './dto/student-booking-response.dto';
import { Booking } from './entities/booking.entity';
import { BookingDomainError } from './errors/booking-domain.error';

@ApiTags('bookings')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Student role required' })
@Roles(UserRole.STUDENT)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List the authenticated student booking timeline' })
  @ApiOkResponse({ type: StudentBookingListResponseDto })
  async findMine(
    @CurrentUser('id') requesterId: string,
  ): Promise<StudentBookingListResponseDto> {
    const { upcoming, history } =
      await this.bookingsService.findForStudent(requesterId);
    return {
      upcoming: upcoming.map((booking) => this.studentResponse(booking)),
      history: history.map((booking) => this.studentResponse(booking)),
    };
  }

  @Get('mine/:id')
  @ApiOperation({
    summary: 'View one booking owned by the authenticated student',
  })
  @ApiOkResponse({ type: StudentBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  async findMineById(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentBookingResponseDto> {
    const booking = await this.bookingsService.findOneForStudent(
      requesterId,
      id,
    );
    if (!booking) throw new NotFoundException('Booking not found');
    return this.studentResponse(booking);
  }

  @Patch('mine/:id/cancel')
  @ApiOperation({ summary: 'Cancel an eligible student booking' })
  @ApiOkResponse({ type: StudentBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Booking can no longer be cancelled' })
  async cancelMine(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentBookingResponseDto> {
    try {
      return this.studentResponse(
        await this.bookingsService.cancel(requesterId, id),
      );
    } catch (error: unknown) {
      if (error instanceof BookingDomainError) {
        if (error.code === 'BOOKING_NOT_FOUND') {
          throw new NotFoundException({
            code: error.code,
            message: error.message,
          });
        }
        if (error.code === 'BOOKING_NOT_CANCELLABLE') {
          throw new ConflictException({
            code: error.code,
            message: error.message,
          });
        }
      }
      throw error;
    }
  }

  @Patch('mine/:id/check-in')
  @ApiOperation({ summary: 'Generate the student check-in code' })
  @ApiOkResponse({ type: StudentBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({
    description: 'Check-in is unavailable or already requested',
  })
  async requestCheckIn(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentBookingResponseDto> {
    try {
      return this.studentResponse(
        await this.bookingsService.requestCheckIn(requesterId, id),
      );
    } catch (error: unknown) {
      if (error instanceof BookingDomainError) {
        const body = { code: error.code, message: error.message };
        if (error.code === 'BOOKING_NOT_FOUND') {
          throw new NotFoundException(body);
        }
        if (
          error.code === 'CHECK_IN_NOT_AVAILABLE' ||
          error.code === 'CHECK_IN_ALREADY_REQUESTED'
        ) {
          throw new ConflictException(body);
        }
      }
      throw error;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a booking request' })
  @ApiCreatedResponse({ type: BookingResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or past booking interval' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  @ApiConflictResponse({ description: 'Resource unavailable or overlapping' })
  async create(
    @CurrentUser('id') requesterId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    try {
      return BookingResponseDto.fromEntity(
        await this.bookingsService.create(requesterId, dto),
      );
    } catch (error: unknown) {
      if (error instanceof BookingDomainError) {
        const body = { code: error.code, message: error.message };
        if (
          error.code === 'INVALID_BOOKING_DATE' ||
          error.code === 'INVALID_BOOKING_RANGE' ||
          error.code === 'BOOKING_IN_PAST'
        ) {
          throw new BadRequestException(body);
        }
        if (error.code === 'RESOURCE_NOT_FOUND') {
          throw new NotFoundException(body);
        }
        if (
          error.code === 'RESOURCE_UNAVAILABLE' ||
          error.code === 'BOOKING_OVERLAP'
        ) {
          throw new ConflictException(body);
        }
      }
      throw error;
    }
  }

  private studentResponse(booking: Booking): StudentBookingResponseDto {
    return StudentBookingResponseDto.fromEntity(
      booking,
      this.bookingsService.canCancel(booking),
      this.bookingsService.canRequestCheckIn(booking),
    );
  }
}
