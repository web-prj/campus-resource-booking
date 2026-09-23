import { QueryFailedError } from 'typeorm';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingDomainError } from './errors/booking-domain.error';
import { BookingsService } from './bookings.service';

const requesterId = '30000000-0000-4000-8000-000000000001';
const resource = {
  id: '20000000-0000-4000-8000-000000000001',
  status: ResourceStatus.ACTIVE,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: '08:00:00',
  closesAt: '18:00:00',
  requiresApproval: false,
} as Resource;
const request = {
  resourceId: resource.id,
  date: '2026-09-16',
  startTime: '09:00',
  endTime: '11:00',
};

function createHarness(overrides: Partial<Resource> = {}) {
  const selectedResource = { ...resource, ...overrides } as Resource;
  const resourceQuery = {
    setLock: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn().mockResolvedValue(selectedResource),
  };
  resourceQuery.setLock.mockReturnValue(resourceQuery);
  resourceQuery.where.mockReturnValue(resourceQuery);

  const bookingRepository = {
    create: jest.fn((value: Partial<Booking>) => value as Booking),
    save: jest.fn(
      async (value: Booking) =>
        ({
          ...value,
          id: '40000000-0000-4000-8000-000000000001',
          createdAt: new Date('2026-09-15T00:00:00.000Z'),
        }) as Booking,
    ),
  };
  const closureRepository = { existsBy: jest.fn().mockResolvedValue(false) };
  const resourceRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(resourceQuery),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Resource) return resourceRepository;
      if (entity === ResourceClosure) return closureRepository;
      if (entity === Booking) return bookingRepository;
      throw new Error('Unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn(
      async (operation: (value: typeof manager) => unknown) =>
        operation(manager),
    ),
  };
  const availabilityEvents = {
    notifyAvailabilityChanged: jest.fn(),
    notifyResourceChanged: jest.fn(),
  };

  const service = new BookingsService(
    dataSource as never,
    () => new Date('2026-09-15T00:00:00.000Z'),
    availabilityEvents as never,
  );

  return {
    service,
    dataSource,
    resourceQuery,
    closureRepository,
    bookingRepository,
  };
}

describe('BookingsService', () => {
  it.each([
    [false, BookingStatus.CONFIRMED],
    [true, BookingStatus.PENDING],
  ])(
    'derives approval status from the locked resource',
    async (requiresApproval, status) => {
      const harness = createHarness({ requiresApproval });

      await expect(
        harness.service.create(requesterId, request),
      ).resolves.toMatchObject({
        requesterId,
        resourceId: resource.id,
        status,
      });
      expect(harness.resourceQuery.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(harness.bookingRepository.create).toHaveBeenCalledWith({
        ...request,
        requesterId,
        status,
      });
    },
  );

  it.each([
    [{ ...request, date: '2026-02-30' }, 'INVALID_BOOKING_DATE'],
    [
      { ...request, startTime: '11:00', endTime: '11:00' },
      'INVALID_BOOKING_RANGE',
    ],
    [
      { ...request, startTime: '12:00', endTime: '11:00' },
      'INVALID_BOOKING_RANGE',
    ],
    [{ ...request, date: '2026-09-14' }, 'BOOKING_IN_PAST'],
    [
      { ...request, date: '2026-09-15', startTime: '06:00', endTime: '07:00' },
      'BOOKING_IN_PAST',
    ],
  ])('rejects invalid temporal input with %s', async (value, code) => {
    const harness = createHarness();

    await expect(
      harness.service.create(requesterId, value),
    ).rejects.toMatchObject({
      code,
    });
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: ResourceStatus.MAINTENANCE }, 'maintenance'],
    [{ status: ResourceStatus.INACTIVE }, 'inactive'],
    [{ operatingDays: [1, 2, 4, 5, 6] }, 'closed weekday'],
    [{ opensAt: '10:00:00' }, 'before opening'],
    [{ closesAt: '10:00:00' }, 'after closing'],
  ])(
    'rejects a resource that is unavailable: %s',
    async (overrides, _reason) => {
      const harness = createHarness(overrides as Partial<Resource>);

      await expect(
        harness.service.create(requesterId, request),
      ).rejects.toMatchObject({
        code: 'RESOURCE_UNAVAILABLE',
      });
      expect(harness.bookingRepository.save).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown resource and a scheduled closure', async () => {
    const unknown = createHarness();
    unknown.resourceQuery.getOne.mockResolvedValue(null);
    await expect(
      unknown.service.create(requesterId, request),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    const closed = createHarness();
    closed.closureRepository.existsBy.mockResolvedValue(true);
    await expect(
      closed.service.create(requesterId, request),
    ).rejects.toMatchObject({
      code: 'RESOURCE_UNAVAILABLE',
    });
  });

  it('enforces exact check-in and no-show capability boundaries', () => {
    const harness = createHarness();
    const booking = {
      status: BookingStatus.CONFIRMED,
      date: '2026-09-15',
      startTime: '09:00:00',
      endTime: '10:00:00',
      checkInRequestedAt: null,
    } as Booking;
    const beforeWindow = new Date('2026-09-15T01:44:59.999Z');
    const atWindow = new Date('2026-09-15T01:45:00.000Z');
    const beforeEnd = new Date('2026-09-15T02:59:59.999Z');
    const atEnd = new Date('2026-09-15T03:00:00.000Z');

    expect(harness.service.canRequestCheckIn(booking, beforeWindow)).toBe(
      false,
    );
    expect(harness.service.canRequestCheckIn(booking, atWindow)).toBe(true);
    expect(harness.service.canRequestCheckIn(booking, beforeEnd)).toBe(true);
    expect(harness.service.canRequestCheckIn(booking, atEnd)).toBe(false);
    expect(
      harness.service.canConfirmCheckIn(
        { ...booking, checkInRequestedAt: atWindow },
        atWindow,
      ),
    ).toBe(true);
    expect(harness.service.canMarkNoShow(booking, beforeEnd)).toBe(false);
    expect(harness.service.canMarkNoShow(booking, atEnd)).toBe(true);
  });

  it('reports whether a pending booking remains reviewable', () => {
    const harness = createHarness();
    const booking = {
      status: BookingStatus.PENDING,
      date: '2026-09-15',
      startTime: '08:00:00',
      endTime: '09:00:00',
    } as Booking;

    expect(
      harness.service.canReview(booking, new Date('2026-09-15T01:59:59.999Z')),
    ).toBe(true);
    expect(
      harness.service.canReview(booking, new Date('2026-09-15T02:00:00.000Z')),
    ).toBe(false);
    expect(
      harness.service.canReview(
        { ...booking, status: BookingStatus.CONFIRMED },
        new Date('2026-09-15T01:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('reports whether a booking has reached its scheduled end', () => {
    const harness = createHarness();
    const booking = {
      date: '2026-09-15',
      startTime: '06:00:00',
      endTime: '07:00:00',
    } as Booking;

    expect(harness.service.hasEnded(booking)).toBe(true);
    expect(
      harness.service.hasEnded(
        { ...booking, endTime: '10:00:00' },
        new Date('2026-09-15T02:59:59.999Z'),
      ),
    ).toBe(false);
  });

  it('translates only the named PostgreSQL overlap exclusion', async () => {
    const overlap = Object.assign(new Error('overlap'), {
      code: '23P01',
      constraint: 'EXCL_bookings_resource_period_blocking',
    });
    const harness = createHarness();
    harness.bookingRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO bookings', [], overlap),
    );

    await expect(
      harness.service.create(requesterId, request),
    ).rejects.toMatchObject({
      code: 'BOOKING_OVERLAP',
    } satisfies Partial<BookingDomainError>);

    const otherFailure = new QueryFailedError(
      'INSERT INTO bookings',
      [],
      Object.assign(new Error('failure'), { code: '23514' }),
    );
    const unrelated = createHarness();
    unrelated.bookingRepository.save.mockRejectedValue(otherFailure);
    await expect(unrelated.service.create(requesterId, request)).rejects.toBe(
      otherFailure,
    );
  });
});
