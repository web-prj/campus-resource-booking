import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserData } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';

/**
 * Owns persistence for users. Auth concerns (hashing, tokens, cookies) stay out
 * of here so this module has one reason to change: how users are stored.
 */
@Injectable()
export class UsersService {
  /** Columns needed when a password check is about to happen. */
  private static readonly WITH_PASSWORD_SELECT: (keyof User)[] = [
    'id',
    'email',
    'passwordHash',
    'fullName',
    'role',
    'createdAt',
    'updatedAt',
  ];

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.usersRepository.save(this.usersRepository.create(data));
    } catch (error: unknown) {
      if (this.isEmailUniqueConstraintViolation(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Includes the password hash, which the entity excludes by default. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: UsersService.WITH_PASSWORD_SELECT,
    });
  }

  private isEmailUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === 'IDX_users_email'
    );
  }
}
