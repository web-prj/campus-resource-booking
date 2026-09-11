import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'nam.tran@usth.edu.vn',
    passwordHash: '$2b$12$hash',
    fullName: 'Nam Tran',
    role: UserRole.STUDENT,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as User;

describe('AuthService', () => {
  let usersService: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmailWithPassword'>
  >;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash' | 'compare'>>;
  let tokenService: jest.Mocked<Pick<TokenService, 'signAccessToken'>>;
  let authService: AuthService;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmailWithPassword: jest.fn(),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('$2b$12$hash'),
      compare: jest.fn(),
    };
    tokenService = { signAccessToken: jest.fn().mockResolvedValue('jwt') };

    authService = new AuthService(
      usersService as unknown as UsersService,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
    );
  });

  describe('register', () => {
    it('hashes the password and never persists the raw value', async () => {
      usersService.create.mockResolvedValue(buildUser());

      await authService.register({
        email: 'nam.tran@usth.edu.vn',
        password: 'password123',
        fullName: 'Nam Tran',
      });

      expect(passwordService.hash).toHaveBeenCalledWith('password123');
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'nam.tran@usth.edu.vn',
        passwordHash: '$2b$12$hash',
        fullName: 'Nam Tran',
        role: UserRole.STUDENT,
      });
    });

    it('assigns the student role rather than trusting client input', async () => {
      usersService.create.mockResolvedValue(buildUser());

      await authService.register({
        email: 'nam.tran@usth.edu.vn',
        password: 'password123',
        fullName: 'Nam Tran',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.STUDENT }),
      );
    });

    it('maps an insert-time duplicate email to 409', async () => {
      usersService.create.mockRejectedValue(new EmailAlreadyExistsError());

      await expect(
        authService.register({
          email: 'nam.tran@usth.edu.vn',
          password: 'password123',
          fullName: 'Nam Tran',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns the user and a signed token on valid credentials', async () => {
      const user = buildUser();
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      await expect(
        authService.login({
          email: 'nam.tran@usth.edu.vn',
          password: 'password123',
        }),
      ).resolves.toEqual({ user, accessToken: 'jwt' });
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(buildUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'nam.tran@usth.edu.vn',
          password: 'wrong',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('still runs a comparison for an unknown account, to keep timing flat', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'nobody@usth.edu.vn',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordService.compare).toHaveBeenCalledWith(
        'password123',
        undefined,
      );
    });

    it('uses one message for both failure modes, so accounts cannot be probed', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      passwordService.compare.mockResolvedValue(false);
      const unknown = await authService
        .login({ email: 'nobody@usth.edu.vn', password: 'password123' })
        .catch((error: Error) => error.message);

      usersService.findByEmailWithPassword.mockResolvedValue(buildUser());
      const wrongPassword = await authService
        .login({ email: 'nam.tran@usth.edu.vn', password: 'wrong' })
        .catch((error: Error) => error.message);

      expect(unknown).toBe(wrongPassword);
    });
  });
});
