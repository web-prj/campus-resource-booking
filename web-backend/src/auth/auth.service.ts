import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

/**
 * Credential handling only. Issuing the cookie is the controller's job, which
 * keeps this service free of HTTP objects and easy to unit test.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedSession> {
    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash: await this.passwordService.hash(dto.password),
        fullName: dto.fullName,
        role: UserRole.STUDENT,
      });

      return this.createSession(user);
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthenticatedSession> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user?.passwordHash,
    );

    // One message for both failure modes, so a caller cannot probe for
    // registered addresses.
    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  private async createSession(user: User): Promise<AuthenticatedSession> {
    return { user, accessToken: await this.tokenService.signAccessToken(user) };
  }
}

/** A verified user plus the token that will be written to the cookie. */
export interface AuthenticatedSession {
  user: User;
  accessToken: string;
}
