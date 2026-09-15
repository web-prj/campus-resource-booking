import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize.decorator';
import { IsStudentEmail } from '../../common/validators/is-student-email.validator';
import { IsWithoutNullByte } from '../../common/validators/is-without-null-byte.validator';
import { MaxUtf8ByteLength } from '../../common/validators/max-utf8-byte-length.validator';

export class LoginDto {
  @ApiProperty({ example: 'nam.tran@usth.edu.vn' })
  @NormalizeEmail()
  @IsStudentEmail()
  @IsWithoutNullByte()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'password123',
    format: 'password',
    maxLength: 72,
  })
  @IsString()
  @MinLength(1)
  @MaxUtf8ByteLength(72)
  password: string;
}
