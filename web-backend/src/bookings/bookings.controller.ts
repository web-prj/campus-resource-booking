import {
  BadRequestException,
  ConflictException,
  Controller,
  NotFoundException,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { BookingDomainError } from './errors/booking-domain.error';

@ApiTags('bookings')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Student role required' })
@Roles(UserRole.STUDENT)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
}
