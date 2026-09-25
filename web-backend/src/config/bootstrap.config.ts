import { registerAs } from '@nestjs/config';
import { normalizeEmailAddress } from '../common/decorators/normalize.decorator';

export const BOOTSTRAP_CONFIG_KEY = 'bootstrap';

export interface BootstrapAccountConfig {
  email: string;
  /** Only used to create the account when it does not exist yet. */
  password?: string;
  fullName: string;
}

function account(
  prefix: 'BOOTSTRAP_ADMIN' | 'BOOTSTRAP_STAFF',
  defaultName: string,
): BootstrapAccountConfig | undefined {
  const email = normalizeEmailAddress(process.env[`${prefix}_EMAIL`] ?? '');
  if (!email) return undefined;
  const password = process.env[`${prefix}_PASSWORD`] ?? '';
  const fullName = (process.env[`${prefix}_NAME`] ?? '').trim();
  return {
    email,
    password: password || undefined,
    fullName: fullName || defaultName,
  };
}

/**
 * Operational accounts provisioned at startup. Each is identified by a USTH
 * email; the password (optional) is used only to create a missing account.
 * Empty values (e.g. unset Compose passthroughs) mean "not configured".
 */
export const bootstrapConfig = registerAs(BOOTSTRAP_CONFIG_KEY, () => ({
  admin: account('BOOTSTRAP_ADMIN', 'Campus Administrator'),
  staff: account('BOOTSTRAP_STAFF', 'Campus Staff'),
}));
