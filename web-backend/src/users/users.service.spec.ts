import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { LastActiveAdminError } from './errors/user-management.error';
import { UserAccessEvents } from './user-access-events';
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
});
