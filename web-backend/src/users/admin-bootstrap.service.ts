import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BootstrapConfig, bootstrapConfig } from '../config';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { ACTIVE_ADMIN_ADVISORY_LOCK } from './users.constants';

export type AdminBootstrapOutcome =
  'not-configured' | 'admin-exists' | 'account-missing' | 'promoted';

/**
 * Creates the first administrator from `BOOTSTRAP_ADMIN_EMAIL`. It only ever
 * promotes an account that already registered through the normal flow; it
 * never creates users or touches passwords, and it does nothing once any
 * active administrator exists.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(bootstrapConfig.KEY)
    private readonly config: BootstrapConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.promoteConfiguredAdmin();
  }

  async promoteConfiguredAdmin(): Promise<AdminBootstrapOutcome> {
    const email = this.config.adminEmail;
    if (!email) return 'not-configured';

    return this.usersRepository.manager.transaction(async (manager) => {
      // Same lock as the last-active-admin guard, so a concurrent demotion or
      // another booting instance cannot interleave with this check.
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        ACTIVE_ADMIN_ADVISORY_LOCK,
      ]);
      const repository = manager.getRepository(User);

      const activeAdmins = await repository.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });
      if (activeAdmins > 0) {
        this.logger.log(
          'BOOTSTRAP_ADMIN_EMAIL ignored: an active administrator already exists.',
        );
        return 'admin-exists';
      }

      const user = await repository.findOne({ where: { email } });
      if (!user) {
        this.logger.warn(
          `BOOTSTRAP_ADMIN_EMAIL ${email} has no account yet. Register it through the application, then restart the backend to promote it.`,
        );
        return 'account-missing';
      }

      await repository.update(user.id, {
        role: UserRole.ADMIN,
        isActive: true,
      });
      this.logger.log(
        `Promoted ${email} to administrator from BOOTSTRAP_ADMIN_EMAIL.`,
      );
      return 'promoted';
    });
  }
}
