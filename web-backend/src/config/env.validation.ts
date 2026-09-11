import * as Joi from 'joi';
import {
  DEFAULT_API_PREFIX,
  DEFAULT_AUTH_COOKIE_NAME,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_DB_PORT,
  DEFAULT_PORT,
} from './defaults';

const DURATION = /^(\d+(ms|s|m|h|d)|\d+)$/;

/**
 * Every variable the app reads is declared here, so a missing or malformed
 * value fails at boot rather than at the first request that needs it.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(DEFAULT_PORT),
  API_PREFIX: Joi.string().default(DEFAULT_API_PREFIX),
  CORS_ORIGINS: Joi.string().default(DEFAULT_CORS_ORIGINS),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(DEFAULT_DB_PORT),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  AUTH_JWT_SECRET: Joi.string().min(32).required(),
  AUTH_TOKEN_EXPIRES_IN: Joi.string().pattern(DURATION).default('1d'),
  AUTH_COOKIE_NAME: Joi.string().default(DEFAULT_AUTH_COOKIE_NAME),
  AUTH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax'),
  AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
  AUTH_COOKIE_SECURE: Joi.boolean().optional(),
  AUTH_BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
}).custom((value, helpers) => {
  // Browsers silently drop a `SameSite=None` cookie that is not `Secure`, which
  // surfaces as a mysteriously broken login rather than a config error.
  const secure = value.AUTH_COOKIE_SECURE ?? value.NODE_ENV === 'production';

  if (value.NODE_ENV === 'production' && !secure) {
    return helpers.message({
      custom:
        'NODE_ENV=production requires AUTH_COOKIE_SECURE=true; session cookies must be HTTPS-only.',
    });
  }

  if (value.AUTH_COOKIE_SAME_SITE === 'none' && !secure) {
    return helpers.message({
      custom:
        'AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true; browsers reject the cookie otherwise.',
    });
  }

  return value;
});
