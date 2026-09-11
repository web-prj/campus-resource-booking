import { SetMetadata } from '@nestjs/common';

export const STRICT_RATE_LIMIT_KEY = 'throttle:strict';

/**
 * Marks a route as brute-force sensitive (login, register). The global throttler
 * resolves it to the tighter `AUTH_THROTTLE_LIMIT` budget, so the numbers stay
 * in configuration rather than being hard-coded at each decorator.
 */
export const StrictRateLimit = () => SetMetadata(STRICT_RATE_LIMIT_KEY, true);
