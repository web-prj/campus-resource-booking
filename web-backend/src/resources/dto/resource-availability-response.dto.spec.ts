import { Booking } from '../../bookings/entities/booking.entity';
import { ResourceClosure } from '../entities/resource-closure.entity';
import { Resource } from '../entities/resource.entity';
import { ResourceStatus } from '../enums/resource-status.enum';
import {
  AvailabilityBlockedReason,
  dayOfWeekFor,
  ResourceAvailabilityResponseDto,
} from './resource-availability-response.dto';

const NOW = new Date('2026-09-14T00:00:00.000Z');
const resource = {
  id: '20000000-0000-4000-8000-000000000001',
  status: ResourceStatus.ACTIVE,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: '08:00:00',
  closesAt: '18:00:00',
  requiresApproval: false,
} as Resource;

function availability(
  value: Resource = resource,
  date = '2026-09-15',
  closure: ResourceClosure | null = null,
  bookings: Booking[] = [],
  now = NOW,
) {
  return ResourceAvailabilityResponseDto.fromResource(
    value,
    date,
    closure,
    bookings,
    now,
  );
}

describe('ResourceAvailabilityResponseDto', () => {
  it('generates ordered one-hour slots for a future open campus day', () => {
    const response = availability();

    expect(response).toMatchObject({
      resourceId: resource.id,
      date: '2026-09-15',
      timeZone: 'Asia/Ho_Chi_Minh',
      status: ResourceStatus.ACTIVE,
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: '08:00',
      closesAt: '18:00',
      blockedReason: null,
      closureReason: null,
      requiresApproval: false,
    });
    expect(response.slots).toHaveLength(10);
    expect(response.slots[0]).toEqual({
      startTime: '08:00',
      endTime: '09:00',
    });
    expect(response.slots.at(-1)).toEqual({
      startTime: '17:00',
      endTime: '18:00',
    });
  });

  it.each([
    [ResourceStatus.MAINTENANCE, AvailabilityBlockedReason.MAINTENANCE],
    [ResourceStatus.INACTIVE, AvailabilityBlockedReason.INACTIVE],
  ])('blocks %s resources', (status, blockedReason) => {
    const response = availability({ ...resource, status } as Resource);

    expect(response.blockedReason).toBe(blockedReason);
    expect(response.slots).toEqual([]);
  });

  it('does not expose a closure reason when status takes precedence', () => {
    const closure = {
      reason: 'Scheduled campus maintenance',
    } as ResourceClosure;
    const response = availability(
      { ...resource, status: ResourceStatus.MAINTENANCE } as Resource,
      '2026-09-15',
      closure,
    );

    expect(response.blockedReason).toBe(AvailabilityBlockedReason.MAINTENANCE);
    expect(response.closureReason).toBeNull();
    expect(response.slots).toEqual([]);
  });

  it('removes hourly slots occupied by pending or confirmed bookings', () => {
    const response = availability(resource, '2026-09-15', null, [
      { startTime: '09:00:00', endTime: '11:00:00' } as Booking,
      { startTime: '14:00:00', endTime: '15:00:00' } as Booking,
    ]);

    expect(response.slots).toHaveLength(7);
    expect(response.slots).not.toEqual(
      expect.arrayContaining([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '14:00', endTime: '15:00' },
      ]),
    );
  });

  it('removes elapsed and current campus-time slots', () => {
    const response = availability(
      resource,
      '2026-09-15',
      null,
      [],
      new Date('2026-09-15T03:00:00.000Z'),
    );

    expect(response.slots[0]).toEqual({
      startTime: '11:00',
      endTime: '12:00',
    });
    expect(response.slots).toHaveLength(7);
  });

  it('lets a scheduled closure override operating hours', () => {
    const closure = {
      reason: 'Scheduled campus maintenance',
    } as ResourceClosure;
    const response = availability(resource, '2026-09-15', closure);

    expect(response.blockedReason).toBe(AvailabilityBlockedReason.CLOSURE);
    expect(response.closureReason).toBe('Scheduled campus maintenance');
    expect(response.slots).toEqual([]);
  });

  it('blocks weekdays outside the resource schedule', () => {
    const response = availability(resource, '2026-09-20');

    expect(response.blockedReason).toBe(AvailabilityBlockedReason.CLOSED_DAY);
    expect(response.slots).toEqual([]);
  });

  it('calculates campus calendar weekdays without process timezone dependence', () => {
    expect(dayOfWeekFor('2026-09-14')).toBe(1);
    expect(dayOfWeekFor('2026-09-20')).toBe(0);
  });
});
