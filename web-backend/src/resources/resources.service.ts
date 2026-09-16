import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import {
  CAMPUS_CLOCK,
  CampusClock,
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
  ) {}

  findAll(): Promise<Resource[]> {
    return this.resourcesRepository.find({
      relations: { building: true },
      order: { name: 'ASC', code: 'ASC' },
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
      return await this.resourcesRepository.manager.transaction(
        async (manager) => {
          const locked = await this.lockResource(manager, resource.id);
          this.requireValidOperatingHours(
            dto.opensAt ?? locked.opensAt,
            dto.closesAt ?? locked.closesAt,
          );

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
    } catch (error: unknown) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateStatus(
    resource: Resource,
    status: ResourceStatus,
  ): Promise<Resource> {
    return this.resourcesRepository.manager.transaction(async (manager) => {
      const locked = await this.lockResource(manager, resource.id);
      await manager.getRepository(Resource).update(locked.id, { status });
      return (await manager.getRepository(Resource).findOne({
        where: { id: locked.id },
        relations: { building: true },
      })) as Resource;
    });
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
      return await this.resourcesRepository.manager.transaction(
        async (manager) => {
          await this.lockResource(manager, resourceId);
          const repository = manager.getRepository(ResourceClosure);
          return repository.save(repository.create({ resourceId, ...dto }));
        },
      );
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
    return this.resourcesRepository.manager.transaction(async (manager) => {
      await this.lockResource(manager, resourceId);
      const result = await manager.getRepository(ResourceClosure).delete({
        id: closureId,
        resourceId,
      });
      return (result.affected ?? 0) > 0;
    });
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

function normalizeTime(value: string): string {
  return value.slice(0, 5);
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
