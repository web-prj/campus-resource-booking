import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthConfig, authConfig } from '../../config';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Reads the token from the httpOnly cookie instead of the Authorization header.
 * The browser attaches it automatically and script cannot read it, which is the
 * whole reason for the cookie transport.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(authConfig.KEY) config: AuthConfig,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (request: Request) =>
        request?.cookies?.[config.cookie.name] ?? null,
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  /**
   * Re-reads the user on every request so a deleted account or a changed role
   * takes effect immediately rather than at token expiry.
   * The return value becomes `request.user`.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return user;
  }
}
