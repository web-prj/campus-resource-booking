import {
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '../../common/decorators/normalize.decorator';
import { IsWithoutNullByte } from '../../common/validators/is-without-null-byte.validator';
import { DATE_PATTERN } from './resource-availability-query.dto';

export class CreateResourceClosureDto {
  @ApiProperty({ example: '2026-09-18' })
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ example: 'Scheduled campus maintenance', maxLength: 255 })
  @TrimString()
  @IsString()
  @IsWithoutNullByte()
  @MinLength(2)
  @MaxLength(255)
  reason: string;
}
