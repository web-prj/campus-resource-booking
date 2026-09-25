import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { LastActiveAdminError } from './errors/user-management.error';
import { UserAccessEvents } from './user-access-events';
import { ACTIVE_ADMIN_ADVISORY_LOCK } from './users.constants';
import { UsersService } from './users.service';

const userData = {
  email: 'nam.tran@usth.edu.vn',
  passwordHash: '$2b$12$hash',
  fullName: 'Nam Tran',
};

describe('UsersService', () => {
  let repository: jest.Mocked<Pick<Repository<User>, 'create' | 'save'>>;
  let service: UsersService;
  let userAccessEvents: UserAccessEvents;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockReturnValue(userData as User),
      save: jest.fn(),
    };
    userAccessEvents = new UserAccessEvents();
    service = new UsersService(
      repository as unknown as Repository<User>,
      userAccessEvents,
    );
  });

  it('translates the email unique constraint into a feature error', async () => {
    const duplicateError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'IDX_users_email',
    });
    repository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO users', [], duplicateError),
    );

    await expect(service.create(userData)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('does not hide unrelated persistence failures', async () => {
    const driverError = Object.assign(new Error('null violation'), {
      code: '23502',
    });
    const failure = new QueryFailedError('INSERT INTO users', [], driverError);
    repository.save.mockRejectedValue(failure);

    await expect(service.create(userData)).rejects.toBe(failure);
  });

  describe('updateStatus', () => {
    const actor = {
      id: '50000000-0000-4000-8000-000000000001',
      role: UserRole.ADMIN,
      isActive: true,
    } as User;
    const target = {
      id: '50000000-0000-4000-8000-000000000002',
      role: UserRole.STUDENT,
      isActive: true,
    } as User;

    function managedService(activeAdmins = 2) {
      const query = {
        setLock: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        getMany: jest.fn().mockResolvedValue([{ ...actor }, { ...target }]),
      };
      query.setLock.mockReturnValue(query);
      query.where.mockReturnValue(query);
      query.orderBy.mockReturnValue(query);
      const transactionalRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(query),
        count: jest.fn().mockResolvedValue(activeAdmins),
        save: jest.fn(async (user: User) => user),
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
        query: jest.fn().mockResolvedValue([]),
      };
      const events = new UserAccessEvents();
      const published: string[] = [];
      events.deactivated$.subscribe((id) => published.push(id));
      const managed = new UsersService(
        {
          manager: {
            transaction: jest.fn(
              async (operation: (value: typeof manager) => unknown) =>
                operation(manager),
            ),
          },
        } as unknown as Repository<User>,
        events,
      );
      return { managed, published, query };
    }

    it('publishes a deactivation after it is committed', async () => {
      const { managed, published } = managedService();

      await expect(
        managed.updateStatus(actor.id, target.id, false),
      ).resolves.toMatchObject({ id: target.id, isActive: false });
      expect(published).toEqual([target.id]);
    });

    it('does not publish when an account is activated', async () => {
      const { managed, published } = managedService();

      await managed.updateStatus(actor.id, target.id, true);
      expect(published).toEqual([]);
    });

    it('does not publish when the deactivation is refused', async () => {
      const { managed, published, query } = managedService(1);
      query.getMany.mockResolvedValue([
        { ...actor },
        { ...target, role: UserRole.ADMIN },
      ]);

      await expect(
        managed.updateStatus(actor.id, target.id, false),
      ).rejects.toBeInstanceOf(LastActiveAdminError);
      expect(published).toEqual([]);
    });
  });

  describe('provisionBootstrapAccount', () => {
    const EMAIL = 'first.admin@usth.edu.vn';
    const account = {
      email: EMAIL,
      fullName: 'Campus Administrator',
      role: UserRole.ADMIN as const,
      passwordHash: '$2b$12$bootstrap',
    };

    function bootstrapHarness(
      options: {
        existing?: Partial<User> | null;
        activeAdmins?: number;
        insertedRows?: number;
      } = {},
    ) {
      const insert = {
        insert: jest.fn(),
        into: jest.fn(),
        values: jest.fn(),
        orIgnore: jest.fn(),
        returning: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          raw: Array.from({ length: options.insertedRows ?? 1 }, () => ({
            id: 'new',
          })),
        }),
      };
      for (const step of [
        'insert',
        'into',
        'values',
        'orIgnore',
        'returning',
      ] as const) {
        insert[step].mockReturnValue(insert);
      }
      const transactionalRepository = {
        findOne: jest.fn().mockResolvedValue(options.existing ?? null),
        count: jest.fn().mockResolvedValue(options.activeAdmins ?? 0),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue(insert),
      };
      const order: string[] = [];
      const manager = {
        query: jest.fn(async () => {
          order.push('lock');
          return [];
        }),
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      };
      transactionalRepository.findOne.mockImplementation(async () => {
        order.push('find');
        return options.existing ?? null;
      });
      const bootstrapService = new UsersService(
        {
          manager: {
            transaction: jest.fn(
              async (operation: (value: typeof manager) => unknown) =>
                operation(manager),
            ),
          },
        } as unknown as Repository<User>,
        userAccessEvents,
      );
      return {
        service: bootstrapService,
        repository: transactionalRepository,
        insert,
        manager,
        order,
      };
    }

    it('creates a missing admin under the active-admin lock', async () => {
      const harness = bootstrapHarness({ activeAdmins: 2 });

      await expect(
        harness.service.provisionBootstrapAccount(account),
      ).resolves.toBe('created');
      expect(harness.order).toEqual(['lock', 'find']);
      expect(harness.manager.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock($1)',
        [ACTIVE_ADMIN_ADVISORY_LOCK],
      );
      expect(harness.insert.values).toHaveBeenCalledWith({
        email: EMAIL,
        passwordHash: '$2b$12$bootstrap',
        fullName: 'Campus Administrator',
        role: UserRole.ADMIN,
        isActive: true,
      });
      expect(harness.insert.orIgnore).toHaveBeenCalled();
    });

    it('creates a missing staff account without taking the admin lock', async () => {
      const harness = bootstrapHarness();

      await expect(
        harness.service.provisionBootstrapAccount({
          ...account,
          email: 'desk.staff@usth.edu.vn',
          role: UserRole.STAFF,
        }),
      ).resolves.toBe('created');
      expect(harness.manager.query).not.toHaveBeenCalled();
      expect(harness.insert.values).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.STAFF, isActive: true }),
      );
    });

    it('reports a registration that won the insert race as unchanged', async () => {
      const harness = bootstrapHarness({ insertedRows: 0 });

      await expect(
        harness.service.provisionBootstrapAccount(account),
      ).resolves.toBe('unchanged');
    });

    it('never creates a missing account without a password', async () => {
      const harness = bootstrapHarness();

      await expect(
        harness.service.provisionBootstrapAccount({
          ...account,
          passwordHash: undefined,
        }),
      ).resolves.toBe('account-missing');
      expect(harness.repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('leaves an existing active account with the configured role alone', async () => {
      const harness = bootstrapHarness({
        existing: { id: 'u1', role: UserRole.ADMIN, isActive: true },
      });

      await expect(
        harness.service.provisionBootstrapAccount(account),
      ).resolves.toBe('already-provisioned');
      expect(harness.repository.update).not.toHaveBeenCalled();
    });

    it('never changes an existing staff-configured account', async () => {
      const harness = bootstrapHarness({
        existing: { id: 'u1', role: UserRole.STUDENT, isActive: true },
      });

      await expect(
        harness.service.provisionBootstrapAccount({
          ...account,
          role: UserRole.STAFF,
        }),
      ).resolves.toBe('unchanged');
      expect(harness.repository.update).not.toHaveBeenCalled();
      expect(harness.repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('promotes and reactivates the configured admin when no active admin exists', async () => {
      const harness = bootstrapHarness({
        existing: { id: 'u1', role: UserRole.STUDENT, isActive: false },
        activeAdmins: 0,
      });

      await expect(
        harness.service.provisionBootstrapAccount(account),
      ).resolves.toBe('promoted');
      expect(harness.repository.count).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN, isActive: true },
      });
      expect(harness.repository.update).toHaveBeenCalledWith('u1', {
        role: UserRole.ADMIN,
        isActive: true,
      });
    });

    it('does not promote the configured admin while another admin is active', async () => {
      const harness = bootstrapHarness({
        existing: { id: 'u1', role: UserRole.ADMIN, isActive: false },
        activeAdmins: 1,
      });

      await expect(
        harness.service.provisionBootstrapAccount(account),
      ).resolves.toBe('admin-exists');
      expect(harness.repository.update).not.toHaveBeenCalled();
    });
  });
});
