import { registerAs } from '@nestjs/config';
import { normalizeEmailAddress } from '../common/decorators/normalize.decorator';

export const BOOTSTRAP_CONFIG_KEY = 'bootstrap';

/**
 * One-time operational bootstrap. `adminEmail` names an already registered
 * USTH account to promote when no active administrator exists. An empty value
 * (e.g. an unset Compose passthrough) means "not configured".
 */
export const bootstrapConfig = registerAs(BOOTSTRAP_CONFIG_KEY, () => {
  const adminEmail = normalizeEmailAddress(
    process.env.BOOTSTRAP_ADMIN_EMAIL ?? '',
  );
  return {
    adminEmail: adminEmail || undefined,
  };
});
