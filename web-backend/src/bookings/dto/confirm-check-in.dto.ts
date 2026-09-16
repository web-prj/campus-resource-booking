import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ConfirmCheckInDto {
  @ApiProperty({
    example: '482193',
    description: 'Six-digit code shown on the student booking',
  })
  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code: string;
}
