import { registerAs } from '@nestjs/config';

export const THROTTLE_CONFIG_KEY = 'throttle';

/**
 * Rate limits. Auth endpoints get a tighter budget than the rest of the API
 * because they are the ones worth brute-forcing.
 */
export const throttleConfig = registerAs(THROTTLE_CONFIG_KEY, () => ({
  /** Window length in seconds. */
  ttl: Number(process.env.THROTTLE_TTL ?? 60),
  /** Requests allowed per window for general traffic. */
  limit: Number(process.env.THROTTLE_LIMIT ?? 100),
  /** Requests allowed per window for login/register. */
  authLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 10),
}));
