import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { UsersService } from './users.service';

const userData = {
  email: 'nam.tran@usth.edu.vn',
  passwordHash: '$2b$12$hash',
  fullName: 'Nam Tran',
};

describe('UsersService', () => {
  let repository: jest.Mocked<Pick<Repository<User>, 'create' | 'save'>>;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockReturnValue(userData as User),
      save: jest.fn(),
    };
    service = new UsersService(repository as unknown as Repository<User>);
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
});
