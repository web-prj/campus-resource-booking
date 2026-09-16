import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimString } from '../../common/decorators/normalize.decorator';
import { IsWithoutNullByte } from '../../common/validators/is-without-null-byte.validator';
import { ResourceType } from '../enums/resource-type.enum';
import { DATE_PATTERN, HOUR_PATTERN } from './resource-availability-query.dto';

export enum ResourceSort {
  NAME_ASC = 'name_asc',
  CAPACITY_ASC = 'capacity_asc',
  CAPACITY_DESC = 'capacity_desc',
}

export class DiscoverResourcesQueryDto {
  @ApiPropertyOptional({ description: 'Resource name, code, or location' })
  @TrimString()
  @IsOptional()
  @IsString()
  @IsWithoutNullByte()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ enum: ResourceType })
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  minCapacity?: number;

  @ApiPropertyOptional({ example: 'whiteboard', maxLength: 50 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @IsWithoutNullByte()
  @MaxLength(50)
  amenity?: string;

  @ApiPropertyOptional({
    example: '2026-09-15',
    description: 'Campus-local date; requires startTime and endTime',
  })
  @ValidateIf(
    (query: DiscoverResourcesQueryDto) =>
      query.date !== undefined ||
      query.startTime !== undefined ||
      query.endTime !== undefined,
  )
  @IsDefined()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional({
    example: '09:00',
    description: 'Whole-hour campus-local start; requires date and endTime',
  })
  @ValidateIf(
    (query: DiscoverResourcesQueryDto) =>
      query.date !== undefined ||
      query.startTime !== undefined ||
      query.endTime !== undefined,
  )
  @IsDefined()
  @Matches(HOUR_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({
    example: '11:00',
    description: 'Whole-hour campus-local end; requires date and startTime',
  })
  @ValidateIf(
    (query: DiscoverResourcesQueryDto) =>
      query.date !== undefined ||
      query.startTime !== undefined ||
      query.endTime !== undefined,
  )
  @IsDefined()
  @Matches(HOUR_PATTERN)
  endTime?: string;

  @ApiPropertyOptional({ enum: ResourceSort, default: ResourceSort.NAME_ASC })
  @IsOptional()
  @IsEnum(ResourceSort)
  sort: ResourceSort = ResourceSort.NAME_ASC;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 24, default: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  pageSize = 9;
}
