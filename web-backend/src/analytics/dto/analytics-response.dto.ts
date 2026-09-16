import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { CAMPUS_TIME_ZONE } from '../../resources/dto/resource-availability-query.dto';

export class AnalyticsStatusDto {
  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ example: 12 })
  count: number;

  @ApiProperty({ example: 40 })
  percentage: number;
}

export class PopularResourceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'A101' })
  code: string;

  @ApiProperty({ example: 'Study room A101' })
  name: string;

  @ApiProperty({ example: 'Main building' })
  building: string;

  @ApiProperty({ example: 18 })
  bookingCount: number;

  @ApiProperty({ example: 36 })
  bookedHours: number;
}

export class PeakHourDto {
  @ApiProperty({ example: 9 })
  hour: number;

  @ApiProperty({ example: '09:00' })
  label: string;

  @ApiProperty({ example: 7 })
  bookingCount: number;
}

export class AnalyticsResponseDto {
  @ApiProperty({ example: '2026-09-01' })
  from: string;

  @ApiProperty({ example: '2026-09-30' })
  to: string;

  @ApiProperty({ example: CAMPUS_TIME_ZONE })
  timeZone: typeof CAMPUS_TIME_ZONE;

  @ApiProperty({ example: 30 })
  totalBookings: number;

  @ApiProperty({ example: 3 })
  cancelledBookings: number;

  @ApiProperty({ example: 10 })
  cancellationRate: number;

  @ApiProperty({ example: 72 })
  scheduledHours: number;

  @ApiProperty({ example: 420 })
  capacityHours: number;

  @ApiProperty({ example: 17.1, nullable: true })
  utilizationRate: number | null;

  @ApiProperty({ example: 8 })
  resourcesRepresented: number;

  @ApiProperty({ type: [AnalyticsStatusDto] })
  statuses: AnalyticsStatusDto[];

  @ApiProperty({ type: [PopularResourceDto] })
  popularResources: PopularResourceDto[];

  @ApiProperty({ type: [PeakHourDto] })
  peakHours: PeakHourDto[];

  @ApiProperty({
    example:
      'Bookings are grouped by scheduled campus date. Utilization includes pending, confirmed, checked-in, and completed bookings.',
  })
  definition: string;
}
