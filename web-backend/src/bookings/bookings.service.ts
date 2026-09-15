import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CAMPUS_CLOCK,
  CampusClock,
  isFutureCampusTime,
} from '../common/time/campus-clock';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingDomainError } from './errors/booking-domain.error';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CAMPUS_CLOCK) private readonly clock: CampusClock,
  ) {}

  async create(requesterId: string, dto: CreateBookingDto): Promise<Booking> {
    this.requireValidRequest(dto);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const resource = await manager
          .getRepository(Resource)
          .createQueryBuilder('resource')
          .setLock('pessimistic_write')
          .where('resource.id = :id', { id: dto.resourceId })
          .getOne();

        if (!resource) {
          throw new BookingDomainError(
            'RESOURCE_NOT_FOUND',
            'Resource not found',
          );
        }

        this.requireOperationalAvailability(resource, dto);

        const closure = await manager.getRepository(ResourceClosure).existsBy({
          resourceId: resource.id,
          date: dto.date,
        });
        if (closure) {
          throw new BookingDomainError(
            'RESOURCE_UNAVAILABLE',
            'The resource is closed on the selected date',
          );
        }

        const booking = manager.getRepository(Booking).create({
          resourceId: resource.id,
          requesterId,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: resource.requiresApproval
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
        });
        return manager.getRepository(Booking).save(booking);
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driverError.code === '23P01' &&
          driverError.constraint === 'EXCL_bookings_resource_period_blocking'
        ) {
          throw new BookingDomainError(
            'BOOKING_OVERLAP',
            'The selected time overlaps another booking',
          );
        }
      }
      throw error;
    }
  }

  private requireValidRequest(dto: CreateBookingDto): void {
    const [year, month, day] = dto.date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BookingDomainError(
        'INVALID_BOOKING_DATE',
        'Booking date must be a real calendar date',
      );
    }
    if (dto.startTime >= dto.endTime) {
      throw new BookingDomainError(
        'INVALID_BOOKING_RANGE',
        'Booking start time must be before end time',
      );
    }

    if (!isFutureCampusTime(dto.date, dto.startTime, this.clock())) {
      throw new BookingDomainError(
        'BOOKING_IN_PAST',
        'Booking start time must be in the future',
      );
    }
  }

  private requireOperationalAvailability(
    resource: Resource,
    dto: CreateBookingDto,
  ): void {
    const [year, month, day] = dto.date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const opensAt = resource.opensAt.slice(0, 5);
    const closesAt = resource.closesAt.slice(0, 5);

    if (
      resource.status !== ResourceStatus.ACTIVE ||
      !resource.operatingDays.includes(weekday) ||
      dto.startTime < opensAt ||
      dto.endTime > closesAt
    ) {
      throw new BookingDomainError(
        'RESOURCE_UNAVAILABLE',
        'The resource is not operational for the selected interval',
      );
    }
  }
}
