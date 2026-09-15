import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { StrictRateLimit } from '../throttler/decorators/strict-rate-limit.decorator';
import { User } from '../users/entities/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthenticatedSession, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthCookieService } from './services/auth-cookie.service';

/**
 * The token never reaches the response body: it is written to an httpOnly
 * cookie, so client code cannot read or store it. Endpoints return the user.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Public()
  @Post('register')
  @StrictRateLimit()
  @ApiOperation({ summary: 'Create a student account and start a session' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid registration details' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    return this.issueSession(await this.authService.register(dto), response);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @ApiOperation({ summary: 'Exchange credentials for a session cookie' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid login details' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    return this.issueSession(await this.authService.login(dto), response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Clear the session cookie' })
  @ApiNoContentResponse({ description: 'Session cookie cleared' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  logout(@Res({ passthrough: true }) response: Response): void {
    this.authCookieService.clear(response);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Return the authenticated user' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  me(@CurrentUser() user: User): UserResponseDto {
    return UserResponseDto.fromEntity(user);
  }

  /** Shared tail of register and login: set the cookie, return the user. */
  private issueSession(
    { user, accessToken }: AuthenticatedSession,
    response: Response,
  ): UserResponseDto {
    this.authCookieService.set(response, accessToken);
    return UserResponseDto.fromEntity(user);
  }
}
