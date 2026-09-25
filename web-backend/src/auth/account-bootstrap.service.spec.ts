import { Logger } from '@nestjs/common';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AccountBootstrapService } from './account-bootstrap.service';
import { PasswordService } from './services/password.service';

function createHarness(
  config: ConstructorParameters<typeof AccountBootstrapService>[2],
) {
  const usersService = {
    provisionBootstrapAccount: jest.fn().mockResolvedValue('created'),
  };
  const passwordService = {
    hash: jest.fn(async (password: string) => `hashed:${password}`),
  };
  const service = new AccountBootstrapService(
    usersService as unknown as UsersService,
    passwordService as unknown as PasswordService,
    config,
  );
  return { service, usersService, passwordService };
}

describe('AccountBootstrapService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing when no bootstrap accounts are configured', async () => {
    const harness = createHarness({ admin: undefined, staff: undefined });

    await harness.service.onApplicationBootstrap();
    expect(
      harness.usersService.provisionBootstrapAccount,
    ).not.toHaveBeenCalled();
  });

  it('provisions the admin, then the staff account, with hashed passwords', async () => {
    const harness = createHarness({
      admin: {
        email: 'first.admin@usth.edu.vn',
        password: 'admin-password',
        fullName: 'Campus Administrator',
      },
      staff: {
        email: 'desk.staff@usth.edu.vn',
        password: 'staff-password',
        fullName: 'Lan Pham',
      },
    });

    await harness.service.onApplicationBootstrap();
    expect(harness.usersService.provisionBootstrapAccount.mock.calls).toEqual([
      [
        {
          email: 'first.admin@usth.edu.vn',
          fullName: 'Campus Administrator',
          role: UserRole.ADMIN,
          passwordHash: 'hashed:admin-password',
        },
      ],
      [
        {
          email: 'desk.staff@usth.edu.vn',
          fullName: 'Lan Pham',
          role: UserRole.STAFF,
          passwordHash: 'hashed:staff-password',
        },
      ],
    ]);
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'Created staff account desk.staff@usth.edu.vn from BOOTSTRAP_STAFF_EMAIL.',
    );
  });

  it('never hashes or sends a password that was not configured', async () => {
    const harness = createHarness({ admin: undefined, staff: undefined });
    harness.usersService.provisionBootstrapAccount.mockResolvedValue(
      'account-missing',
    );

    await expect(
      harness.service.provision(UserRole.ADMIN, {
        email: 'first.admin@usth.edu.vn',
        fullName: 'Campus Administrator',
      }),
    ).resolves.toBe('account-missing');
    expect(harness.passwordService.hash).not.toHaveBeenCalled();
    expect(harness.usersService.provisionBootstrapAccount).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: undefined }),
    );
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('Set BOOTSTRAP_ADMIN_PASSWORD to create it'),
    );
  });

  it('warns without changing an existing account that differs', async () => {
    const harness = createHarness({ admin: undefined, staff: undefined });
    harness.usersService.provisionBootstrapAccount.mockResolvedValue(
      'unchanged',
    );

    await harness.service.provision(UserRole.STAFF, {
      email: 'desk.staff@usth.edu.vn',
      password: 'staff-password',
      fullName: 'Campus Staff',
    });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('it was not changed'),
    );
  });
});
