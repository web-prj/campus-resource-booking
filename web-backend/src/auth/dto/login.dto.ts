import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize.decorator';
import { IsStudentEmail } from '../../common/validators/is-student-email.validator';
import { MaxUtf8ByteLength } from '../../common/validators/max-utf8-byte-length.validator';

export class LoginDto {
  @ApiProperty({ example: 'nam.tran@usth.edu.vn' })
  @NormalizeEmail()
  @IsStudentEmail()
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
