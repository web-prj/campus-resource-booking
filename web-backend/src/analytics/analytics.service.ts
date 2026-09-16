import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { CAMPUS_TIME_ZONE } from '../resources/dto/resource-availability-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

const STATUS_ORDER = Object.values(BookingStatus);
const DEMAND_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];
const UTILIZATION_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
  BookingStatus.COMPLETED,
];
const DEFINITION =
  'Bookings are grouped by scheduled campus date. Total and status figures include every request. Popular resources and peak hours include pending or accepted requests, including no-shows; cancelled and rejected requests are excluded. Scheduled utilization includes pending through completed bookings for resources in the current active catalog; cancelled, rejected, and no-show requests are excluded. Capacity uses those resources’ current configured operating days and hours from their creation date, less full-day closures.';

type CountRow = { status: BookingStatus; count: string };
type PopularRow = {
  id: string;
  code: string;
  name: string;
  building: string;
  bookingCount: string;
  bookedHours: string;
};
type PeakRow = { hour: string; bookingCount: string };
type ResourceHoursRow = {
  id: string;
  operatingDays: number[];
  opensAt: string;
  closesAt: string;
  createdAt: Date;
};
type ClosureRow = { resourceId: string; date: string };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {}

  async getSummary(from: string, to: string): Promise<AnalyticsResponseDto> {
    return this.bookings.manager.transaction(
      'REPEATABLE READ',
      async (manager) => {
        const counts = await this.statusCounts(manager, from, to);
        const popularRows = await this.popularResources(manager, from, to);
        const peakRows = await this.peakHours(manager, from, to);
        const scheduledHours = await this.scheduledHours(manager, from, to);
        const resources = await manager
          .getRepository(Resource)
          .createQueryBuilder('resource')
          .select('resource.id', 'id')
          .addSelect('resource.operatingDays', 'operatingDays')
          .addSelect('resource.opensAt', 'opensAt')
          .addSelect('resource.closesAt', 'closesAt')
          .addSelect('resource.createdAt', 'createdAt')
          .where('resource.status = :status', {
            status: ResourceStatus.ACTIVE,
          })
          .getRawMany<ResourceHoursRow>();
        const closures = await manager
          .getRepository(ResourceClosure)
          .createQueryBuilder('closure')
          .select('closure.resourceId', 'resourceId')
          .addSelect('closure.date', 'date')
          .where('closure.date BETWEEN :from AND :to', { from, to })
          .getRawMany<ClosureRow>();

        const countMap = new Map(
          counts.map((row) => [row.status, Number(row.count)]),
        );
        const totalBookings = STATUS_ORDER.reduce(
          (sum, status) => sum + (countMap.get(status) ?? 0),
          0,
        );
        const cancelledBookings = countMap.get(BookingStatus.CANCELLED) ?? 0;
        const popularResources = popularRows.map((row) => ({
          ...row,
          bookingCount: Number(row.bookingCount),
          bookedHours: Number(row.bookedHours),
        }));
        const capacityHours = this.capacityHours(from, to, resources, closures);

        return {
          from,
          to,
          timeZone: CAMPUS_TIME_ZONE,
          totalBookings,
          cancelledBookings,
          cancellationRate: this.percentage(cancelledBookings, totalBookings),
          scheduledHours,
          capacityHours,
          utilizationRate:
            capacityHours === 0
              ? null
              : this.percentage(scheduledHours, capacityHours),
          resourcesRepresented: popularResources.length,
          statuses: STATUS_ORDER.map((status) => {
            const count = countMap.get(status) ?? 0;
            return {
              status,
              count,
              percentage: this.percentage(count, totalBookings),
            };
          }),
          popularResources: popularResources.slice(0, 5),
          peakHours: peakRows.map((row) => {
            const hour = Number(row.hour);
            return {
              hour,
              label: `${String(hour).padStart(2, '0')}:00`,
              bookingCount: Number(row.bookingCount),
            };
          }),
          definition: DEFINITION,
        };
      },
    );
  }

  private statusCounts(
    manager: EntityManager,
    from: string,
    to: string,
  ): Promise<CountRow[]> {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('booking.date BETWEEN :from AND :to', { from, to })
      .groupBy('booking.status')
      .getRawMany<CountRow>();
  }

  private popularResources(
    manager: EntityManager,
    from: string,
    to: string,
  ): Promise<PopularRow[]> {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .innerJoin('booking.resource', 'resource')
      .innerJoin('resource.building', 'building')
      .select('resource.id', 'id')
      .addSelect('resource.code', 'code')
      .addSelect('resource.name', 'name')
      .addSelect('building.name', 'building')
      .addSelect('COUNT(*)', 'bookingCount')
      .addSelect(
        `SUM(EXTRACT(EPOCH FROM (booking.endTime - booking.startTime)) / 3600)`,
        'bookedHours',
      )
      .where('booking.date BETWEEN :from AND :to', { from, to })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: DEMAND_STATUSES,
      })
      .groupBy('resource.id')
      .addGroupBy('building.name')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('resource.name', 'ASC')
      .addOrderBy('resource.code', 'ASC')
      .getRawMany<PopularRow>();
  }

  private peakHours(
    manager: EntityManager,
    from: string,
    to: string,
  ): Promise<PeakRow[]> {
    return manager.query<PeakRow[]>(
      `SELECT hour, COUNT(*)::text AS "bookingCount"
       FROM bookings booking
       CROSS JOIN LATERAL generate_series(
         EXTRACT(HOUR FROM booking.start_time)::int,
         EXTRACT(HOUR FROM booking.end_time)::int - 1
       ) AS hour
       WHERE booking.booking_date BETWEEN $1 AND $2
         AND booking.status = ANY($3::bookings_status_enum[])
       GROUP BY hour
       ORDER BY hour ASC`,
      [from, to, DEMAND_STATUSES],
    );
  }

  private async scheduledHours(
    manager: EntityManager,
    from: string,
    to: string,
  ): Promise<number> {
    const [row] = await manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .innerJoin('booking.resource', 'resource')
      .select(
        `COALESCE(SUM(EXTRACT(EPOCH FROM (booking.endTime - booking.startTime)) / 3600), 0)`,
        'hours',
      )
      .where('booking.date BETWEEN :from AND :to', { from, to })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: UTILIZATION_STATUSES,
      })
      .andWhere('resource.status = :resourceStatus', {
        resourceStatus: ResourceStatus.ACTIVE,
      })
      .getRawMany<{ hours: string }>();
    return Number(row.hours);
  }

  private capacityHours(
    from: string,
    to: string,
    resources: ResourceHoursRow[],
    closures: ClosureRow[],
  ): number {
    const closed = new Set(
      closures.map((row) => `${row.resourceId}:${row.date}`),
    );
    let total = 0;
    for (const resource of resources) {
      const dailyHours =
        this.hour(resource.closesAt) - this.hour(resource.opensAt);
      const createdDate = this.campusDate(resource.createdAt);
      for (const date of this.dates(from, to)) {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (
          date >= createdDate &&
          resource.operatingDays.includes(weekday) &&
          !closed.has(`${resource.id}:${date}`)
        ) {
          total += dailyHours;
        }
      }
    }
    return total;
  }

  private *dates(from: string, to: string): Generator<string> {
    const current = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (current <= end) {
      yield current.toISOString().slice(0, 10);
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  private campusDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: CAMPUS_TIME_ZONE,
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private hour(value: string): number {
    return Number(value.slice(0, 2));
  }

  private percentage(numerator: number, denominator: number): number {
    return denominator === 0
      ? 0
      : Math.round((numerator / denominator) * 1000) / 10;
  }
}
