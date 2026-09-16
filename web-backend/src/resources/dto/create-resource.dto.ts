import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimString } from '../../common/decorators/normalize.decorator';
import { IsWithoutNullByte } from '../../common/validators/is-without-null-byte.validator';
import { ResourceType } from '../enums/resource-type.enum';

const NormalizeResourceCode = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

const NormalizeAmenities = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'string' ? item.trim().toLowerCase() : item,
        )
      : value,
  );

export class CreateResourceDto {
  @ApiProperty({ example: 'ROOM-A103', maxLength: 30 })
  @NormalizeResourceCode()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message: 'code must use uppercase letters, numbers, and single hyphens',
  })
  code: string;

  @ApiProperty({ example: 'Study Room A103', maxLength: 120 })
  @TrimString()
  @IsString()
  @IsWithoutNullByte()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'A group study room near the library.' })
  @TrimString()
  @IsOptional()
  @IsString()
  @IsWithoutNullByte()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: ResourceType, example: ResourceType.ROOM })
  @IsEnum(ResourceType)
  type: ResourceType;

  @ApiProperty({ minimum: 1, maximum: 10000, example: 8 })
  @IsInt()
  @Min(1)
  @Max(10000)
  capacity: number;

  @ApiProperty({ example: 'First floor', maxLength: 120 })
  @TrimString()
  @IsString()
  @IsWithoutNullByte()
  @MinLength(2)
  @MaxLength(120)
  location: string;

  @ApiPropertyOptional({ type: [String], example: ['whiteboard', 'display'] })
  @NormalizeAmenities()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @IsWithoutNullByte({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5, 6],
    description: 'Campus-local weekdays, where Sunday is 0',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  operatingDays?: number[];

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):00$/)
  opensAt?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):00$/)
  closesAt?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  buildingId: string;
}
