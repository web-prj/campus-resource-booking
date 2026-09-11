import { registerAs } from '@nestjs/config';
import {
  DEFAULT_API_PREFIX,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_PORT,
} from './defaults';

export const APP_CONFIG_KEY = 'app';

/**
 * Process-level settings. Registered as a namespace so consumers inject a typed
 * object instead of reaching for `process.env` or stringly-typed lookups.
 */
export const appConfig = registerAs(APP_CONFIG_KEY, () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  apiPrefix: process.env.API_PREFIX ?? DEFAULT_API_PREFIX,
  /** Browser origins allowed to send credentialed requests. */
  corsOrigins: (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
