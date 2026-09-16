import { IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const CAMPUS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

export class ResourceAvailabilityQueryDto {
  @ApiProperty({ example: '2026-09-15', description: 'Campus-local date' })
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  date: string;
}
