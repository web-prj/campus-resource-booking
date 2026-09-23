import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Building } from './entities/building.entity';
import { ResourceClosure } from './entities/resource-closure.entity';
import { Resource } from './entities/resource.entity';
import {
  DiscoverResourcesQueryDto,
  ResourceSort,
} from './dto/discover-resources-query.dto';
import { ResourceStatus } from './enums/resource-status.enum';
import { ResourceType } from './enums/resource-type.enum';
import { ResourceCodeAlreadyExistsError } from './errors/resource-code-already-exists.error';
import {
  BuildingNotFoundError,
  InvalidOperatingHoursError,
  ResourcesService,
} from './resources.service';

const building = { id: '10000000-0000-4000-8000-000000000001' } as Building;
const resource = {
  id: '20000000-0000-4000-8000-000000000001',
  code: 'ROOM-A101',
  name: 'Study Room A101',
  description: null,
  status: ResourceStatus.ACTIVE,
  opensAt: '08:00:00',
  closesAt: '18:00:00',
  building,
} as Resource;

describe('ResourcesService', () => {
  let resourcesRepository: jest.Mocked<
    Pick<
      Repository<Resource>,
      'create' | 'createQueryBuilder' | 'save' | 'findOne' | 'update'
    >
  > & {
    manager: {
      transaction: jest.Mock;
      getRepository: jest.Mock;
    };
  };
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Resource>,
      | 'innerJoinAndSelect'
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'addOrderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
      | 'setLock'
      | 'getOne'
    >
  >;
  let buildingsRepository: jest.Mocked<Pick<Repository<Building>, 'existsBy'>>;
  let closuresRepository: {
    create: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
  };
  let bookingsRepository: { find: jest.Mock };
  let service: ResourcesService;

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[resource], 1]),
      setLock: jest.fn(),
      getOne: jest.fn().mockResolvedValue(resource),
    };
    for (const method of [
      'innerJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
      'setLock',
    ] as const) {
      queryBuilder[method].mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Resource>,
      );
    }

    resourcesRepository = {
      create: jest.fn().mockReturnValue(resource),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(
          queryBuilder as unknown as SelectQueryBuilder<Resource>,
        ),
      save: jest.fn().mockResolvedValue(resource),
      findOne: jest.fn().mockResolvedValue(resource),
      update: jest
        .fn()
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }),
      manager: {
        transaction: jest.fn(),
        getRepository: jest.fn(),
      },
    };
    resourcesRepository.manager.getRepository.mockImplementation(
      (entity: unknown) => {
        if (entity === ResourceClosure) {
          return closuresRepository as unknown as Repository<ResourceClosure>;
        }
        if (entity === Booking) {
          return bookingsRepository as unknown as Repository<Booking>;
        }
        return resourcesRepository as unknown as Repository<Resource>;
      },
    );
    resourcesRepository.manager.transaction.mockImplementation(
      async (
        isolationOrOperation: string | ((manager: unknown) => unknown),
        maybeOperation?: (manager: unknown) => unknown,
      ) => {
        const operation =
          typeof isolationOrOperation === 'function'
            ? isolationOrOperation
            : maybeOperation;
        return operation?.(resourcesRepository.manager);
      },
    );
    buildingsRepository = {
      existsBy: jest.fn().mockResolvedValue(true),
    };
    closuresRepository = {
      create: jest.fn((value: ResourceClosure) => value),
      delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value: ResourceClosure) => value),
    };
    bookingsRepository = { find: jest.fn().mockResolvedValue([]) };
    const availabilityEvents = {
      notifyAvailabilityChanged: jest.fn(),
      notifyResourceChanged: jest.fn(),
    };
    service = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      buildingsRepository as unknown as Repository<Building>,
      closuresRepository as unknown as Repository<ResourceClosure>,
      bookingsRepository as unknown as Repository<Booking>,
      () => new Date('2026-09-14T00:00:00.000Z'),
      availabilityEvents as never,
    );
  });

  it('builds an active-only discovery query with filters and paging', async () => {
    const query: DiscoverResourcesQueryDto = {
      q: 'Room_100%',
      buildingId: building.id,
      type: ResourceType.ROOM,
      minCapacity: 6,
      amenity: 'whiteboard',
      sort: ResourceSort.CAPACITY_DESC,
      page: 2,
      pageSize: 9,
    };

    await expect(service.discover(query)).resolves.toEqual([[resource], 1]);
    expect(resourcesRepository.manager.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function),
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'resource.status = :status',
      { status: ResourceStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('resource.name ILIKE :search'),
      { search: '%Room\\_100\\%%' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.buildingId = :buildingId',
      { buildingId: building.id },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.type = :type',
      { type: ResourceType.ROOM },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.capacity >= :minCapacity',
      { minCapacity: 6 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      ':amenity = ANY(resource.amenities)',
      { amenity: 'whiteboard' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'resource.capacity',
      'DESC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'resource.code',
      'ASC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(9);
    expect(queryBuilder.take).toHaveBeenCalledWith(9);
  });

  it('returns no resources for an elapsed campus interval', async () => {
    const availabilityEvents = {
      notifyAvailabilityChanged: jest.fn(),
      notifyResourceChanged: jest.fn(),
    };
    const elapsedService = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      buildingsRepository as unknown as Repository<Building>,
      closuresRepository as unknown as Repository<ResourceClosure>,
      bookingsRepository as unknown as Repository<Booking>,
      () => new Date('2026-09-15T03:00:00.000Z'),
      availabilityEvents as never,
    );

    await expect(
      elapsedService.discover({
        date: '2026-09-15',
        startTime: '09:00',
        endTime: '10:00',
        sort: ResourceSort.NAME_ASC,
        page: 1,
        pageSize: 9,
      }),
    ).resolves.toEqual([[], 0]);
    expect(resourcesRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('filters discovery by an operational date and interval', async () => {
    await service.discover({
      date: '2026-09-15',
      startTime: '09:00',
      endTime: '11:00',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      ':dayOfWeek = ANY(resource.operatingDays)',
      { dayOfWeek: 2 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.opensAt <= :startTime',
      { startTime: '09:00' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.closesAt >= :endTime',
      { endTime: '11:00' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('resource_closures'),
      { availabilityDate: '2026-09-15' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings booking'),
      expect.objectContaining({
        blockingStatuses: ['pending', 'confirmed', 'checked_in'],
      }),
    );
  });

  it.each([
    ['2026-02-30', '09:00', '10:00'],
    ['2026-09-15', '11:00', '10:00'],
    ['2026-09-15', '10:00', '10:00'],
  ])(
    'rejects an invalid availability interval %s %s-%s',
    async (date, startTime, endTime) => {
      await expect(
        service.discover({
          date,
          startTime,
          endTime,
          sort: ResourceSort.NAME_ASC,
          page: 1,
          pageSize: 9,
        }),
      ).rejects.toThrow();
    },
  );

  it('loads availability inputs from one repeatable-read snapshot', async () => {
    const closure = {
      resourceId: resource.id,
      date: '2026-09-15',
    } as ResourceClosure;
    const bookings = [{ id: 'booking-1' }] as Booking[];
    closuresRepository.findOneBy.mockResolvedValue(closure);
    bookingsRepository.find.mockResolvedValue(bookings);

    await expect(
      service.findAvailabilitySnapshot(resource.id, '2026-09-15'),
    ).resolves.toEqual({ resource, closure, bookings });

    expect(resourcesRepository.manager.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function),
    );
    expect(resourcesRepository.findOne).toHaveBeenCalledWith({
      where: { id: resource.id },
    });
    expect(closuresRepository.findOneBy).toHaveBeenCalledWith({
      resourceId: resource.id,
      date: '2026-09-15',
    });
    expect(bookingsRepository.find).toHaveBeenCalledWith({
      where: [
        { resourceId: resource.id, date: '2026-09-15', status: 'pending' },
        { resourceId: resource.id, date: '2026-09-15', status: 'confirmed' },
        { resourceId: resource.id, date: '2026-09-15', status: 'checked_in' },
      ],
      order: { startTime: 'ASC' },
    });
  });

  it('returns no availability snapshot for an unknown resource', async () => {
    resourcesRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findAvailabilitySnapshot(resource.id, '2026-09-15'),
    ).resolves.toBeNull();
    expect(closuresRepository.findOneBy).not.toHaveBeenCalled();
    expect(bookingsRepository.find).not.toHaveBeenCalled();
  });

  it('finds resource details only when they are active', async () => {
    await service.findDiscoverableById(resource.id);

    expect(resourcesRepository.findOne).toHaveBeenCalledWith({
      where: { id: resource.id, status: ResourceStatus.ACTIVE },
      relations: { building: true },
    });
  });

  it('rejects a resource assigned to an unknown building', async () => {
    buildingsRepository.existsBy.mockResolvedValue(false);

    await expect(
      service.create({
        code: 'ROOM-A103',
        name: 'Study Room A103',
        type: ResourceType.ROOM,
        capacity: 8,
        location: 'First floor',
        buildingId: building.id,
      }),
    ).rejects.toBeInstanceOf(BuildingNotFoundError);

    expect(resourcesRepository.save).not.toHaveBeenCalled();
  });

  it('translates the resource code unique constraint', async () => {
    const duplicateError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'IDX_resources_code',
    });
    resourcesRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO resources', [], duplicateError),
    );

    await expect(
      service.create({
        code: 'ROOM-A101',
        name: 'Duplicate room',
        type: ResourceType.ROOM,
        capacity: 8,
        location: 'First floor',
        buildingId: building.id,
      }),
    ).rejects.toBeInstanceOf(ResourceCodeAlreadyExistsError);
  });

  it('translates a building foreign-key race', async () => {
    const foreignKeyError = Object.assign(new Error('foreign key violation'), {
      code: '23503',
      constraint: 'FK_resources_building_id',
    });
    resourcesRepository.update.mockRejectedValue(
      new QueryFailedError('UPDATE resources', [], foreignKeyError),
    );

    await expect(
      service.update(resource, { buildingId: building.id }),
    ).rejects.toBeInstanceOf(BuildingNotFoundError);
  });

  it.each([
    [{ opensAt: '18:00' }],
    [{ opensAt: '19:00' }],
    [{ closesAt: '08:00' }],
    [{ closesAt: '07:00' }],
  ])(
    'rejects a one-sided operating-hour update outside persisted bounds',
    async (changes) => {
      await expect(service.update(resource, changes)).rejects.toBeInstanceOf(
        InvalidOperatingHoursError,
      );
      expect(resourcesRepository.update).not.toHaveBeenCalled();
    },
  );

  it('updates only detail and operating-hour fields present in the request', async () => {
    await service.update(resource, {
      name: 'Updated Room',
      capacity: 12,
      description: '',
      operatingDays: [1, 2, 3, 4, 5],
      opensAt: '09:00',
      closesAt: '17:00',
    });

    expect(resourcesRepository.update).toHaveBeenCalledWith(resource.id, {
      name: 'Updated Room',
      capacity: 12,
      description: null,
      operatingDays: [1, 2, 3, 4, 5],
      opensAt: '09:00',
      closesAt: '17:00',
    });
  });

  it('loads pending, confirmed, and checked-in bookings that block availability', async () => {
    const bookings = [{ id: 'booking-1' }] as Booking[];
    bookingsRepository.find.mockResolvedValue(bookings);

    await expect(
      service.findBlockingBookings(resource.id, '2026-09-18'),
    ).resolves.toBe(bookings);
    expect(bookingsRepository.find).toHaveBeenCalledWith({
      where: [
        { resourceId: resource.id, date: '2026-09-18', status: 'pending' },
        { resourceId: resource.id, date: '2026-09-18', status: 'confirmed' },
        { resourceId: resource.id, date: '2026-09-18', status: 'checked_in' },
      ],
      order: { startTime: 'ASC' },
    });
  });

  it('creates, lists, and deletes a scoped closure', async () => {
    const closure = {
      id: '40000000-0000-4000-8000-000000000001',
      resourceId: resource.id,
      date: '2026-09-18',
      reason: 'Campus maintenance',
    } as ResourceClosure;
    closuresRepository.create.mockReturnValue(closure);
    closuresRepository.save.mockResolvedValue(closure);
    closuresRepository.find.mockResolvedValue([closure]);

    await expect(
      service.createClosure(resource.id, {
        date: closure.date,
        reason: closure.reason,
      }),
    ).resolves.toBe(closure);
    await expect(service.findClosures(resource.id)).resolves.toEqual([closure]);
    await expect(service.deleteClosure(resource.id, closure.id)).resolves.toBe(
      true,
    );

    expect(closuresRepository.delete).toHaveBeenCalledWith({
      id: closure.id,
      resourceId: resource.id,
    });
  });

  it('updates status without writing stale detail fields', async () => {
    await service.updateStatus(resource, ResourceStatus.MAINTENANCE);

    expect(resourcesRepository.update).toHaveBeenCalledWith(resource.id, {
      status: ResourceStatus.MAINTENANCE,
    });
  });

  it('does not hide unrelated persistence failures', async () => {
    const driverError = Object.assign(new Error('not-null violation'), {
      code: '23502',
    });
    const failure = new QueryFailedError(
      'INSERT INTO resources',
      [],
      driverError,
    );
    resourcesRepository.save.mockRejectedValue(failure);

    await expect(
      service.create({
        code: 'ROOM-A103',
        name: 'Study Room A103',
        type: ResourceType.ROOM,
        capacity: 8,
        location: 'First floor',
        buildingId: building.id,
      }),
    ).rejects.toBe(failure);
  });
});
