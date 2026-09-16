import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../common/decorators/normalize.decorator';
import { IsWithoutNullByte } from '../../common/validators/is-without-null-byte.validator';

export class RejectBookingDto {
  @ApiProperty({
    example: 'The laboratory is reserved for a scheduled practical session.',
    minLength: 3,
    maxLength: 500,
  })
  @TrimString()
  @IsString()
  @IsWithoutNullByte()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
