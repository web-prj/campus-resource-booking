import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthConfig, authConfig } from '../config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      // asProvider() wires the typed auth namespace in without repeating the
      // imports/inject/useFactory boilerplate.
      ...authConfig.asProvider(),
      useFactory: (config: AuthConfig) => ({
        secret: config.jwt.secret,
        signOptions: { expiresIn: config.jwt.expiresIn },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    PasswordService,
    TokenService,
    JwtStrategy,
  ],
  // Exported so other modules can reuse cookie handling (e.g. session refresh)
  // and verify session tokens (e.g. the WebSocket gateway).
  exports: [AuthService, AuthCookieService, JwtModule],
})
export class AuthModule {}
