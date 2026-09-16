import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateUserData } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import {
  LastActiveAdminError,
  SelfManagementNotAllowedError,
  UserNotFoundError,
} from './errors/user-management.error';

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
    'isActive',
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

  async findForAdministration({
    q,
    role,
    isActive,
    page,
    pageSize,
  }: AdminUsersQueryDto): Promise<{
    items: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC');

    if (q) {
      query.andWhere(
        `(user.fullName ILIKE :search ESCAPE '\\' OR user.email ILIKE :search ESCAPE '\\')`,
        { search: `%${this.escapeLike(q)}%` },
      );
    }
    if (role) query.andWhere('user.role = :role', { role });
    if (isActive !== undefined) {
      query.andWhere('user.isActive = :isActive', { isActive });
    }

    const [items, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async updateRole(
    actorId: string,
    targetId: string,
    role: UserRole,
  ): Promise<User> {
    return this.updateManagedUser(actorId, targetId, (target) => {
      if (target.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
        return { role, removesActiveAdmin: target.isActive };
      }
      return { role, removesActiveAdmin: false };
    });
  }

  async updateStatus(
    actorId: string,
    targetId: string,
    isActive: boolean,
  ): Promise<User> {
    return this.updateManagedUser(actorId, targetId, (target) => ({
      isActive,
      removesActiveAdmin:
        target.role === UserRole.ADMIN && target.isActive && !isActive,
    }));
  }

  /** Includes the password hash, which the entity excludes by default. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: UsersService.WITH_PASSWORD_SELECT,
    });
  }

  private async updateManagedUser(
    actorId: string,
    targetId: string,
    change: (target: User) => Partial<Pick<User, 'role' | 'isActive'>> & {
      removesActiveAdmin: boolean;
    },
  ): Promise<User> {
    if (actorId === targetId) throw new SelfManagementNotAllowedError();

    return this.usersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const locked = await repository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id IN (:...ids)', { ids: [actorId, targetId] })
        .orderBy('user.id', 'ASC')
        .getMany();
      const actor = locked.find((user) => user.id === actorId);
      const target = locked.find((user) => user.id === targetId);

      if (!target) throw new UserNotFoundError();
      if (!actor || !actor.isActive || actor.role !== UserRole.ADMIN) {
        throw new SelfManagementNotAllowedError();
      }

      const { removesActiveAdmin, ...updates } = change(target);
      if (removesActiveAdmin) {
        const activeAdmins = await repository.count({
          where: { role: UserRole.ADMIN, isActive: true },
        });
        if (activeAdmins <= 1) throw new LastActiveAdminError();
      }

      Object.assign(target, updates);
      return repository.save(target);
    });
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
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
