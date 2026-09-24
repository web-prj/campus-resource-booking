import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import {
  CAMPUS_CLOCK,
  CampusClock,
  campusDateOf,
  campusTimeOf,
  isFutureCampusTime,
} from '../common/time/campus-clock';
import { CreateResourceDto } from './dto/create-resource.dto';
import { CreateResourceClosureDto } from './dto/create-resource-closure.dto';
import {
  DiscoverResourcesQueryDto,
  ResourceSort,
} from './dto/discover-resources-query.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Building } from './entities/building.entity';
import { ResourceClosure } from './entities/resource-closure.entity';
import { Resource } from './entities/resource.entity';
import { ResourceStatus } from './enums/resource-status.enum';
import { ResourceCodeAlreadyExistsError } from './errors/resource-code-already-exists.error';
import {
  MAX_LISTED_CONFLICTS,
  ResourceHasActiveBookingsError,
} from './errors/resource-has-active-bookings.error';
import { AvailabilityEventsService } from '../events/availability-events.service';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private readonly resourcesRepository: Repository<Resource>,
    @InjectRepository(Building)
    private readonly buildingsRepository: Repository<Building>,
    @InjectRepository(ResourceClosure)
    private readonly closuresRepository: Repository<ResourceClosure>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @Inject(CAMPUS_CLOCK) private readonly clock: CampusClock,
    private readonly availabilityEvents: AvailabilityEventsService,
  ) {}

  findPage(page: number, pageSize: number): Promise<[Resource[], number]> {
    return this.resourcesRepository.findAndCount({
      relations: { building: true },
      order: { name: 'ASC', code: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  findBuildings(): Promise<Building[]> {
    return this.buildingsRepository.find({ order: { name: 'ASC' } });
  }

  currentTime(): Date {
    return this.clock();
  }

  async discover(
    query: DiscoverResourcesQueryDto,
  ): Promise<[Resource[], number]> {
    if (query.date && query.startTime && query.endTime) {
      this.requireValidInterval(query.date, query.startTime, query.endTime);
      if (!isFutureCampusTime(query.date, query.startTime, this.clock())) {
        return [[], 0];
      }
    }

    return this.resourcesRepository.manager.transaction(
      'REPEATABLE READ',
      (manager) => this.discoverFrom(manager.getRepository(Resource), query),
    );
  }

  private discoverFrom(
    repository: Repository<Resource>,
    query: DiscoverResourcesQueryDto,
  ): Promise<[Resource[], number]> {
    const builder = repository
      .createQueryBuilder('resource')
      .innerJoinAndSelect('resource.building', 'building')
      .where('resource.status = :status', { status: ResourceStatus.ACTIVE });

    if (query.q) {
      builder.andWhere(
        '(resource.name ILIKE :search OR resource.code ILIKE :search OR resource.location ILIKE :search OR building.name ILIKE :search OR building.code ILIKE :search)',
        { search: `%${this.escapeLike(query.q)}%` },
      );
    }
    if (query.buildingId) {
      builder.andWhere('resource.buildingId = :buildingId', {
        buildingId: query.buildingId,
      });
    }
    if (query.type) {
      builder.andWhere('resource.type = :type', { type: query.type });
    }
    if (query.minCapacity !== undefined) {
      builder.andWhere('resource.capacity >= :minCapacity', {
        minCapacity: query.minCapacity,
      });
    }
    if (query.amenity) {
      builder.andWhere(':amenity = ANY(resource.amenities)', {
        amenity: query.amenity,
      });
    }
    if (query.date && query.startTime && query.endTime) {
      const dayOfWeek = this.dayOfWeekFor(query.date);
      builder
        .andWhere(':dayOfWeek = ANY(resource.operatingDays)', { dayOfWeek })
        .andWhere('resource.opensAt <= :startTime', {
          startTime: query.startTime,
        })
        .andWhere('resource.closesAt >= :endTime', { endTime: query.endTime })
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM resource_closures closure
            WHERE closure.resource_id = resource.id
              AND closure.date = :availabilityDate
          )`,
          { availabilityDate: query.date },
        )
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM bookings booking
            WHERE booking.resource_id = resource.id
              AND booking.booking_date = :availabilityDate
              AND booking.status IN (:...blockingStatuses)
              AND booking.start_time < :endTime
              AND booking.end_time > :startTime
          )`,
          {
            blockingStatuses: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
            ],
          },
        );
    }

    if (query.sort === ResourceSort.CAPACITY_ASC) {
      builder.orderBy('resource.capacity', 'ASC');
    } else if (query.sort === ResourceSort.CAPACITY_DESC) {
      builder.orderBy('resource.capacity', 'DESC');
    } else {
      builder.orderBy('resource.name', 'ASC');
    }

    return builder
      .addOrderBy('resource.code', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
  }

  async findDiscoverableById(id: string): Promise<Resource | null> {
    return this.resourcesRepository.findOne({
      where: { id, status: ResourceStatus.ACTIVE },
      relations: { building: true },
    });
  }

  async findById(id: string): Promise<Resource | null> {
    return this.resourcesRepository.findOne({
      where: { id },
      relations: { building: true },
    });
  }

  findBlockingBookings(resourceId: string, date: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: [
        { resourceId, date, status: BookingStatus.PENDING },
        { resourceId, date, status: BookingStatus.CONFIRMED },
        { resourceId, date, status: BookingStatus.CHECKED_IN },
      ],
      order: { startTime: 'ASC' },
    });
  }

  async create(dto: CreateResourceDto): Promise<Resource> {
    await this.requireBuilding(dto.buildingId);

    this.requireValidOperatingHours(
      dto.opensAt ?? '08:00',
      dto.closesAt ?? '18:00',
    );

    const resource = this.resourcesRepository.create({
      ...dto,
      description: dto.description || null,
      amenities: dto.amenities ?? [],
      requiresApproval: dto.requiresApproval ?? false,
      operatingDays: dto.operatingDays ?? [1, 2, 3, 4, 5, 6],
      opensAt: dto.opensAt ?? '08:00',
      closesAt: dto.closesAt ?? '18:00',
    });

    try {
      const saved = await this.resourcesRepository.save(resource);
      return (await this.findById(saved.id)) as Resource;
    } catch (error: unknown) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(resource: Resource, dto: UpdateResourceDto): Promise<Resource> {
    if (dto.buildingId !== undefined) {
      await this.requireBuilding(dto.buildingId);
    }

    try {
      const updated = await this.resourcesRepository.manager.transaction(
        async (manager) => {
          const locked = await this.lockResource(manager, resource.id);
          this.requireValidOperatingHours(
            dto.opensAt ?? locked.opensAt,
            dto.closesAt ?? locked.closesAt,
          );
          const schedule = this.changedSchedule(locked, dto);
          if (schedule) {
            await this.requireNoActiveBookings(
              manager,
              locked.id,
              `booking.status IN (:...reviewableStatuses)
                AND ${ENDS_AFTER_NOW}
                AND (
                  NOT (CAST(EXTRACT(DOW FROM booking.date) AS integer) = ANY(CAST(:operatingDays AS integer[])))
                  OR booking.startTime < :opensAt
                  OR booking.endTime > :closesAt
                )`,
              { reviewableStatuses: REVIEWABLE_STATUSES, ...schedule },
              (count) =>
                `Resolve ${bookingCount(count)} outside the new operating schedule before saving it.`,
            );
          }

          const changes = this.detailChanges(dto);
          if (Object.keys(changes).length) {
            await manager.getRepository(Resource).update(locked.id, changes);
          }
          return (await manager.getRepository(Resource).findOne({
            where: { id: locked.id },
            relations: { building: true },
          })) as Resource;
        },
      );
      this.availabilityEvents.notifyResourceChanged(updated.id);
      return updated;
    } catch (error: unknown) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateStatus(
    resource: Resource,
    status: ResourceStatus,
  ): Promise<Resource> {
    const updated = await this.resourcesRepository.manager.transaction(
      async (manager) => {
        const locked = await this.lockResource(manager, resource.id);
        if (status !== ResourceStatus.ACTIVE) {
          await this.requireNoActiveBookings(
            manager,
            locked.id,
            `((booking.status IN (:...reviewableStatuses) AND ${ENDS_AFTER_NOW})
              OR booking.status = :checkedInStatus)`,
            {
              reviewableStatuses: REVIEWABLE_STATUSES,
              checkedInStatus: BookingStatus.CHECKED_IN,
            },
            (count) =>
              `Resolve ${bookingCount(count)} before setting this resource to ${status}.`,
          );
        }
        await manager.getRepository(Resource).update(locked.id, { status });
        return (await manager.getRepository(Resource).findOne({
          where: { id: locked.id },
          relations: { building: true },
        })) as Resource;
      },
    );
    this.availabilityEvents.notifyResourceChanged(updated.id);
    return updated;
  }

  async findAvailabilitySnapshot(
    resourceId: string,
    date: string,
  ): Promise<{
    resource: Resource;
    closure: ResourceClosure | null;
    bookings: Booking[];
  } | null> {
    this.requireValidDate(date);
    return this.resourcesRepository.manager.transaction(
      'REPEATABLE READ',
      async (manager) => {
        const resource = await manager
          .getRepository(Resource)
          .findOne({ where: { id: resourceId } });
        if (!resource) return null;

        const closure = await manager
          .getRepository(ResourceClosure)
          .findOneBy({ resourceId, date });
        const bookings = await manager.getRepository(Booking).find({
          where: [
            { resourceId, date, status: BookingStatus.PENDING },
            { resourceId, date, status: BookingStatus.CONFIRMED },
            { resourceId, date, status: BookingStatus.CHECKED_IN },
          ],
          order: { startTime: 'ASC' },
        });

        return { resource, closure, bookings };
      },
    );
  }

  async findClosure(
    resourceId: string,
    date: string,
  ): Promise<ResourceClosure | null> {
    this.requireValidDate(date);
    return this.closuresRepository.findOneBy({ resourceId, date });
  }

  findClosures(resourceId: string): Promise<ResourceClosure[]> {
    return this.closuresRepository.find({
      where: { resourceId },
      order: { date: 'ASC' },
    });
  }

  async createClosure(
    resourceId: string,
    dto: CreateResourceClosureDto,
  ): Promise<ResourceClosure> {
    this.requireValidDate(dto.date);
    try {
      const closure = await this.resourcesRepository.manager.transaction(
        async (manager) => {
          await this.lockResource(manager, resourceId);
          await this.requireNoActiveBookings(
            manager,
            resourceId,
            `booking.date = :closureDate
              AND booking.status IN (:...blockingStatuses)
              AND ${ENDS_AFTER_NOW}`,
            { closureDate: dto.date, blockingStatuses: BLOCKING_STATUSES },
            (count) =>
              `Resolve ${bookingCount(count)} before closing this resource on ${dto.date}.`,
          );
          const repository = manager.getRepository(ResourceClosure);
          return repository.save(repository.create({ resourceId, ...dto }));
        },
      );
      this.availabilityEvents.notifyAvailabilityChanged(resourceId, dto.date);
      return closure;
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driverError.code === '23505' &&
          driverError.constraint === 'IDX_resource_closures_resource_date'
        ) {
          throw new ResourceClosureAlreadyExistsError();
        }
      }
      throw error;
    }
  }

  async deleteClosure(resourceId: string, closureId: string): Promise<boolean> {
    const closure = await this.closuresRepository.findOneBy({
      id: closureId,
      resourceId,
    });
    const deleted = await this.resourcesRepository.manager.transaction(
      async (manager) => {
        await this.lockResource(manager, resourceId);
        const result = await manager.getRepository(ResourceClosure).delete({
          id: closureId,
          resourceId,
        });
        return (result.affected ?? 0) > 0;
      },
    );
    if (deleted && closure) {
      this.availabilityEvents.notifyAvailabilityChanged(
        resourceId,
        closure.date,
      );
    }
    return deleted;
  }

  private async lockResource(
    manager: EntityManager,
    resourceId: string,
  ): Promise<Resource> {
    const resource = await manager
      .getRepository(Resource)
      .createQueryBuilder('resource')
      .setLock('pessimistic_write')
      .where('resource.id = :id', { id: resourceId })
      .getOne();
    if (!resource) throw new ResourceNotFoundError();
    return resource;
  }

  /**
   * Throws when bookings matched by `condition` would be stranded by a change.
   * Runs inside the caller's transaction after the resource row is locked;
   * booking creation takes the same lock, so no new booking can slip in
   * between this check and the write.
   */
  private async requireNoActiveBookings(
    manager: EntityManager,
    resourceId: string,
    condition: string,
    parameters: Record<string, unknown>,
    message: (count: number) => string,
  ): Promise<void> {
    const now = this.clock();
    const [bookings, count] = await manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .where('booking.resourceId = :resourceId', { resourceId })
      .andWhere(condition, {
        ...parameters,
        today: campusDateOf(now),
        nowTime: campusTimeOf(now),
      })
      .orderBy('booking.date', 'ASC')
      .addOrderBy('booking.startTime', 'ASC')
      .addOrderBy('booking.id', 'ASC')
      .take(MAX_LISTED_CONFLICTS)
      .getManyAndCount();
    if (count === 0) return;

    throw new ResourceHasActiveBookingsError(
      message(count),
      count,
      bookings.map((booking) => ({
        id: booking.id,
        date: booking.date,
        startTime: normalizeTime(booking.startTime),
        endTime: normalizeTime(booking.endTime),
        status: booking.status,
      })),
    );
  }

  /** The resulting schedule when an update changes it, otherwise null. */
  private changedSchedule(
    locked: Resource,
    dto: UpdateResourceDto,
  ): { operatingDays: number[]; opensAt: string; closesAt: string } | null {
    const operatingDays = dto.operatingDays ?? locked.operatingDays;
    const opensAt = normalizeTime(dto.opensAt ?? locked.opensAt);
    const closesAt = normalizeTime(dto.closesAt ?? locked.closesAt);
    const daysKey = (days: number[]) =>
      [...days]
        .map(Number)
        .sort((left, right) => left - right)
        .join(',');
    const changed =
      daysKey(operatingDays) !== daysKey(locked.operatingDays) ||
      opensAt !== normalizeTime(locked.opensAt) ||
      closesAt !== normalizeTime(locked.closesAt);
    return changed ? { operatingDays, opensAt, closesAt } : null;
  }

  private detailChanges(
    dto: UpdateResourceDto,
  ): QueryDeepPartialEntity<Resource> {
    const changes: QueryDeepPartialEntity<Resource> = {};

    if (dto.code !== undefined) changes.code = dto.code;
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.description !== undefined)
      changes.description = dto.description || null;
    if (dto.type !== undefined) changes.type = dto.type;
    if (dto.capacity !== undefined) changes.capacity = dto.capacity;
    if (dto.location !== undefined) changes.location = dto.location;
    if (dto.amenities !== undefined) changes.amenities = dto.amenities;
    if (dto.requiresApproval !== undefined) {
      changes.requiresApproval = dto.requiresApproval;
    }
    if (dto.operatingDays !== undefined) {
      changes.operatingDays = dto.operatingDays;
    }
    if (dto.opensAt !== undefined) changes.opensAt = dto.opensAt;
    if (dto.closesAt !== undefined) changes.closesAt = dto.closesAt;
    if (dto.buildingId !== undefined) changes.buildingId = dto.buildingId;

    return changes;
  }

  private requireValidInterval(
    date: string,
    startTime: string,
    endTime: string,
  ): void {
    this.requireValidDate(date);
    if (startTime >= endTime) throw new InvalidAvailabilityRangeError();
  }

  private requireValidOperatingHours(opensAt: string, closesAt: string): void {
    if (normalizeTime(opensAt) >= normalizeTime(closesAt)) {
      throw new InvalidOperatingHoursError();
    }
  }

  private requireValidDate(date: string): void {
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new InvalidAvailabilityDateError();
    }
  }

  private dayOfWeekFor(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private async requireBuilding(id: string): Promise<void> {
    if (!(await this.buildingsRepository.existsBy({ id }))) {
      throw new BuildingNotFoundError();
    }
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
        constraint?: string;
      };

      if (
        driverError.code === '23505' &&
        driverError.constraint === 'IDX_resources_code'
      ) {
        throw new ResourceCodeAlreadyExistsError();
      }

      if (
        driverError.code === '23503' &&
        driverError.constraint === 'FK_resources_building_id'
      ) {
        throw new BuildingNotFoundError();
      }

      if (
        driverError.code === '23514' &&
        (driverError.constraint === 'CHK_resources_operating_hours_order' ||
          driverError.constraint === 'CHK_resources_operating_hours_whole_hour')
      ) {
        throw new InvalidOperatingHoursError();
      }
    }

    throw error;
  }
}

/** Bookings that still hold a slot before check-in. */
const REVIEWABLE_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
/** Bookings that block availability. */
const BLOCKING_STATUSES = [...REVIEWABLE_STATUSES, BookingStatus.CHECKED_IN];
/** The booking's scheduled end (campus time) is after `:today :nowTime`. */
const ENDS_AFTER_NOW =
  '(booking.date > :today OR (booking.date = :today AND booking.endTime > :nowTime))';

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function bookingCount(count: number): string {
  return `${count} active booking${count === 1 ? '' : 's'}`;
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found');
    this.name = 'ResourceNotFoundError';
  }
}

export class BuildingNotFoundError extends Error {
  constructor() {
    super('Building not found');
    this.name = 'BuildingNotFoundError';
  }
}

export class InvalidAvailabilityDateError extends Error {
  constructor() {
    super('Availability date must be a real calendar date');
    this.name = 'InvalidAvailabilityDateError';
  }
}

export class InvalidAvailabilityRangeError extends Error {
  constructor() {
    super('Availability start time must be before end time');
    this.name = 'InvalidAvailabilityRangeError';
  }
}

export class InvalidOperatingHoursError extends Error {
  constructor() {
    super('Opening time must be before closing time');
    this.name = 'InvalidOperatingHoursError';
  }
}

export class ResourceClosureAlreadyExistsError extends Error {
  constructor() {
    super('A closure already exists for this resource and date');
    this.name = 'ResourceClosureAlreadyExistsError';
  }
}
