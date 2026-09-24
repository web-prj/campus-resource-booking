import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { ACTIVE_ADMIN_ADVISORY_LOCK } from './users.constants';

const EMAIL = 'first.admin@usth.edu.vn';

function createHarness(
  options: {
    adminEmail?: string;
    activeAdmins?: number;
    user?: User | null;
  } = {},
) {
  const adminEmail = 'adminEmail' in options ? options.adminEmail : EMAIL;
  const activeAdmins = options.activeAdmins ?? 0;
  const user =
    'user' in options
      ? options.user
      : ({
          id: '60000000-0000-4000-8000-000000000001',
          email: EMAIL,
          role: UserRole.STUDENT,
          isActive: false,
        } as User);
  const repository = {
    count: jest.fn().mockResolvedValue(activeAdmins),
    findOne: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn().mockReturnValue(repository),
  };
  const transaction = jest.fn(
    async (operation: (value: typeof manager) => unknown) => operation(manager),
  );
  const service = new AdminBootstrapService(
    { manager: { transaction } } as unknown as Repository<User>,
    { adminEmail },
  );
  return { service, repository, manager, transaction };
}

describe('AdminBootstrapService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing when BOOTSTRAP_ADMIN_EMAIL is not configured', async () => {
    const harness = createHarness({ adminEmail: undefined });

    await expect(harness.service.promoteConfiguredAdmin()).resolves.toBe(
      'not-configured',
    );
    await harness.service.onApplicationBootstrap();
    expect(harness.transaction).not.toHaveBeenCalled();
  });

  it('promotes and reactivates the registered account when no active admin exists', async () => {
    const harness = createHarness();

    await expect(harness.service.promoteConfiguredAdmin()).resolves.toBe(
      'promoted',
    );
    expect(harness.manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [ACTIVE_ADMIN_ADVISORY_LOCK],
    );
    expect(harness.repository.count).toHaveBeenCalledWith({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    expect(harness.repository.findOne).toHaveBeenCalledWith({
      where: { email: EMAIL },
    });
    expect(harness.repository.update).toHaveBeenCalledWith(
      '60000000-0000-4000-8000-000000000001',
      { role: UserRole.ADMIN, isActive: true },
    );
  });

  it('takes the advisory lock before counting administrators', async () => {
    const harness = createHarness();
    const order: string[] = [];
    harness.manager.query.mockImplementation(async () => {
      order.push('lock');
      return [];
    });
    harness.repository.count.mockImplementation(async () => {
      order.push('count');
      return 0;
    });

    await harness.service.promoteConfiguredAdmin();
    expect(order).toEqual(['lock', 'count']);
  });

  it('leaves users untouched once an active administrator exists', async () => {
    const harness = createHarness({ activeAdmins: 1 });

    await expect(harness.service.promoteConfiguredAdmin()).resolves.toBe(
      'admin-exists',
    );
    expect(harness.repository.findOne).not.toHaveBeenCalled();
    expect(harness.repository.update).not.toHaveBeenCalled();
  });

  it('never creates an account that has not registered', async () => {
    const harness = createHarness({ user: null });

    await expect(harness.service.promoteConfiguredAdmin()).resolves.toBe(
      'account-missing',
    );
    expect(harness.repository.update).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('has no account yet'),
    );
  });
});
