import { ApiProperty } from '@nestjs/swagger';
import { Booking } from '../../bookings/entities/booking.entity';
import { isFutureCampusTime } from '../../common/time/campus-clock';
import { Resource } from '../entities/resource.entity';
import { ResourceClosure } from '../entities/resource-closure.entity';
import { ResourceStatus } from '../enums/resource-status.enum';
import { CAMPUS_TIME_ZONE } from './resource-availability-query.dto';

export enum AvailabilityBlockedReason {
  MAINTENANCE = 'maintenance',
  INACTIVE = 'inactive',
  CLOSURE = 'closure',
  CLOSED_DAY = 'closed_day',
}

export class AvailabilitySlotResponseDto {
  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '09:00' })
  endTime: string;
}

export class ResourceAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ example: '2026-09-15' })
  date: string;

  @ApiProperty({ example: CAMPUS_TIME_ZONE })
  timeZone: string;

  @ApiProperty({ example: '08:00' })
  opensAt: string;

  @ApiProperty({ example: '18:00' })
  closesAt: string;

  @ApiProperty({ enum: AvailabilityBlockedReason, nullable: true })
  blockedReason: AvailabilityBlockedReason | null;

  @ApiProperty({ nullable: true, example: 'Campus maintenance' })
  closureReason: string | null;

  @ApiProperty({ example: false })
  requiresApproval: boolean;

  @ApiProperty({ type: AvailabilitySlotResponseDto, isArray: true })
  slots: AvailabilitySlotResponseDto[];

  static fromResource(
    resource: Resource,
    date: string,
    closure: ResourceClosure | null,
    bookings: Booking[] = [],
    now: Date = new Date(),
  ): ResourceAvailabilityResponseDto {
    const dayOfWeek = dayOfWeekFor(date);
    let blockedReason: AvailabilityBlockedReason | null = null;

    if (resource.status === ResourceStatus.MAINTENANCE) {
      blockedReason = AvailabilityBlockedReason.MAINTENANCE;
    } else if (resource.status === ResourceStatus.INACTIVE) {
      blockedReason = AvailabilityBlockedReason.INACTIVE;
    } else if (closure) {
      blockedReason = AvailabilityBlockedReason.CLOSURE;
    } else if (!resource.operatingDays.includes(dayOfWeek)) {
      blockedReason = AvailabilityBlockedReason.CLOSED_DAY;
    }

    return {
      resourceId: resource.id,
      date,
      timeZone: CAMPUS_TIME_ZONE,
      opensAt: normalizeTime(resource.opensAt),
      closesAt: normalizeTime(resource.closesAt),
      blockedReason,
      closureReason:
        blockedReason === AvailabilityBlockedReason.CLOSURE
          ? (closure?.reason ?? null)
          : null,
      requiresApproval: resource.requiresApproval,
      slots:
        blockedReason === null
          ? hourlySlots(resource.opensAt, resource.closesAt).filter(
              (slot) =>
                isFutureCampusTime(date, slot.startTime, now) &&
                !bookings.some(
                  (booking) =>
                    normalizeTime(booking.startTime) < slot.endTime &&
                    normalizeTime(booking.endTime) > slot.startTime,
                ),
            )
          : [],
    };
  }
}

export function dayOfWeekFor(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function hourlySlots(
  opensAt: string,
  closesAt: string,
): AvailabilitySlotResponseDto[] {
  const startHour = Number(opensAt.slice(0, 2));
  const endHour = Number(closesAt.slice(0, 2));
  const slots: AvailabilitySlotResponseDto[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    slots.push({
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: `${String(hour + 1).padStart(2, '0')}:00`,
    });
  }

  return slots;
}
