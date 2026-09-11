import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  NormalizeEmail,
  TrimString,
} from '../../common/decorators/normalize.decorator';
import { IsStudentEmail } from '../../common/validators/is-student-email.validator';
import { MaxUtf8ByteLength } from '../../common/validators/max-utf8-byte-length.validator';

export class RegisterDto {
  @ApiProperty({ example: 'nam.tran@usth.edu.vn' })
  @NormalizeEmail()
  @IsStudentEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxUtf8ByteLength(72) // bcrypt only hashes the first 72 bytes.
  password: string;

  @ApiProperty({ example: 'Nam Tran' })
  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName: string;
}
