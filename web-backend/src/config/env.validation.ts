import * as Joi from 'joi';
import { durationToMs } from '../common/utils/duration.util';
import {
  isStudentEmail,
  STUDENT_EMAIL_DOMAIN,
} from '../common/validators/is-student-email.validator';
import { hasMaxUtf8ByteLength } from '../common/validators/max-utf8-byte-length.validator';
import {
  DEFAULT_API_PREFIX,
  DEFAULT_AUTH_COOKIE_NAME,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_DB_PORT,
  DEFAULT_PORT,
} from './defaults';

const DURATION = /^(\d+(ms|s|m|h|d)|\d+)$/;

const bootstrapEmail = (name: string) =>
  Joi.string()
    .trim()
    .lowercase()
    .max(255)
    .allow('')
    .optional()
    .custom((value: string, helpers) =>
      isStudentEmail(value)
        ? value
        : helpers.message({
            custom: `${name} must be an exact @${STUDENT_EMAIL_DOMAIN} address.`,
          }),
    );

// Same rules as registration: 8+ characters, at most 72 bytes (bcrypt limit).
const bootstrapPassword = (name: string) =>
  Joi.string()
    .allow('')
    .optional()
    .custom((value: string, helpers) =>
      value.length >= 8 && hasMaxUtf8ByteLength(value, 72)
        ? value
        : helpers.message({
            custom: `${name} must be 8 characters to 72 bytes long.`,
          }),
    );

const bootstrapName = Joi.string().trim().max(120).allow('').optional();

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
  AUTH_TOKEN_EXPIRES_IN: Joi.string()
    .pattern(DURATION)
    .custom((value: string, helpers) => {
      const milliseconds = durationToMs(value);
      return Number.isSafeInteger(milliseconds) && milliseconds > 0
        ? value
        : helpers.message({
            custom:
              'AUTH_TOKEN_EXPIRES_IN must be a positive, safely representable duration.',
          });
    })
    .default('1d'),
  AUTH_COOKIE_NAME: Joi.string().default(DEFAULT_AUTH_COOKIE_NAME),
  AUTH_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict').default('lax'),
  AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
  AUTH_COOKIE_SECURE: Joi.boolean().optional(),
  AUTH_BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
  // Optional startup accounts. Empty (as an unset Compose passthrough renders
  // it) means unset.
  BOOTSTRAP_ADMIN_EMAIL: bootstrapEmail('BOOTSTRAP_ADMIN_EMAIL'),
  BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword('BOOTSTRAP_ADMIN_PASSWORD'),
  BOOTSTRAP_ADMIN_NAME: bootstrapName,
  BOOTSTRAP_STAFF_EMAIL: bootstrapEmail('BOOTSTRAP_STAFF_EMAIL'),
  BOOTSTRAP_STAFF_PASSWORD: bootstrapPassword('BOOTSTRAP_STAFF_PASSWORD'),
  BOOTSTRAP_STAFF_NAME: bootstrapName,
}).custom((value, helpers) => {
  // Production session cookies must stay HTTPS-only. Cross-site cookies are
  // rejected by the field schema until unsafe methods have CSRF protection.
  const secure = value.AUTH_COOKIE_SECURE ?? value.NODE_ENV === 'production';

  if (value.NODE_ENV === 'production' && !secure) {
    return helpers.message({
      custom:
        'NODE_ENV=production requires AUTH_COOKIE_SECURE=true; session cookies must be HTTPS-only.',
    });
  }

  if (value.NODE_ENV !== 'development' && value.DB_SYNCHRONIZE) {
    return helpers.message({
      custom:
        'DB_SYNCHRONIZE=true is allowed only in development; use reviewed migrations elsewhere.',
    });
  }

  if (
    value.NODE_ENV === 'production' &&
    value.AUTH_JWT_SECRET === 'change-me-in-production-min-32-characters-long'
  ) {
    return helpers.message({
      custom:
        'NODE_ENV=production requires a generated AUTH_JWT_SECRET, not the example placeholder.',
    });
  }

  for (const prefix of ['BOOTSTRAP_ADMIN', 'BOOTSTRAP_STAFF']) {
    if (
      !value[`${prefix}_EMAIL`] &&
      (value[`${prefix}_PASSWORD`] || value[`${prefix}_NAME`])
    ) {
      return helpers.message({
        custom: `${prefix}_PASSWORD and ${prefix}_NAME require ${prefix}_EMAIL.`,
      });
    }
  }

  if (
    value.BOOTSTRAP_ADMIN_EMAIL &&
    value.BOOTSTRAP_ADMIN_EMAIL === value.BOOTSTRAP_STAFF_EMAIL
  ) {
    return helpers.message({
      custom: 'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_STAFF_EMAIL must differ.',
    });
  }

  return value;
});
