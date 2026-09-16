import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';
import { DATE_PATTERN } from '../../resources/dto/resource-availability-query.dto';

export class AnalyticsQueryDto {
  @ApiProperty({
    example: '2026-09-01',
    description: 'First campus-local booking date',
  })
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  from: string;

  @ApiProperty({
    example: '2026-09-30',
    description: 'Last campus-local booking date',
  })
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  to: string;
}
