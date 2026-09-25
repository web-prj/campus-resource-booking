import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { BootstrapConfig, bootstrapConfig } from '../config';
import { BootstrapAccountConfig } from '../config/bootstrap.config';
import { UserRole } from '../users/enums/user-role.enum';
import { BootstrapAccountOutcome, UsersService } from '../users/users.service';
import { PasswordService } from './services/password.service';

type BootstrapRole = UserRole.ADMIN | UserRole.STAFF;

/**
 * Provisions the admin and staff accounts named by `BOOTSTRAP_ADMIN_*` and
 * `BOOTSTRAP_STAFF_*` at startup. Missing accounts are created when a password
 * is configured; existing accounts are left as they are (see
 * UsersService.provisionBootstrapAccount for the admin recovery exception).
 */
@Injectable()
export class AccountBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccountBootstrapService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    @Inject(bootstrapConfig.KEY)
    private readonly config: BootstrapConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.provision(UserRole.ADMIN, this.config.admin);
    await this.provision(UserRole.STAFF, this.config.staff);
  }

  async provision(
    role: BootstrapRole,
    account: BootstrapAccountConfig | undefined,
  ): Promise<BootstrapAccountOutcome | 'not-configured'> {
    if (!account) return 'not-configured';

    const outcome = await this.usersService.provisionBootstrapAccount({
      email: account.email,
      fullName: account.fullName,
      role,
      passwordHash: account.password
        ? await this.passwordService.hash(account.password)
        : undefined,
    });
    this.report(role, account.email, outcome);
    return outcome;
  }

  private report(
    role: BootstrapRole,
    email: string,
    outcome: BootstrapAccountOutcome,
  ): void {
    const variable = `BOOTSTRAP_${role.toUpperCase()}_EMAIL`;
    switch (outcome) {
      case 'created':
        this.logger.log(`Created ${role} account ${email} from ${variable}.`);
        return;
      case 'promoted':
        this.logger.log(
          `Promoted ${email} to administrator from ${variable}: no active administrator existed.`,
        );
        return;
      case 'already-provisioned':
        this.logger.log(`${variable} ${email} is already an active ${role}.`);
        return;
      case 'admin-exists':
        this.logger.log(
          `${variable} ${email} left unchanged: another active administrator exists.`,
        );
        return;
      case 'unchanged':
        this.logger.warn(
          `${variable} ${email} already exists with a different role or status; it was not changed. Manage it from the admin console.`,
        );
        return;
      case 'account-missing':
        this.logger.warn(
          `${variable} ${email} has no account yet. Set BOOTSTRAP_${role.toUpperCase()}_PASSWORD to create it, or register it and restart the backend.`,
        );
        return;
    }
  }
}
