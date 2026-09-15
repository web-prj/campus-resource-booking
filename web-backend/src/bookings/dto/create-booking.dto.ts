import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID, Matches } from 'class-validator';
import {
  DATE_PATTERN,
  HOUR_PATTERN,
} from '../../resources/dto/resource-availability-query.dto';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-09-16', description: 'Campus-local date' })
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ example: '09:00' })
  @Matches(HOUR_PATTERN)
  startTime: string;

  @ApiProperty({ example: '10:00' })
  @Matches(HOUR_PATTERN)
  endTime: string;
}
