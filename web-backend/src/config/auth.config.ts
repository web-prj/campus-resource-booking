import { registerAs } from '@nestjs/config';
import { durationToMs, parseDuration } from '../common/utils/duration.util';
import { DEFAULT_AUTH_COOKIE_NAME } from './defaults';

export const AUTH_CONFIG_KEY = 'auth';

/**
 * Session settings. The signed token is transported in an httpOnly cookie, so
 * the token lifetime and the cookie lifetime are derived from one value and can
 * never drift apart.
 */
export const authConfig = registerAs(AUTH_CONFIG_KEY, () => {
  const expiresIn = parseDuration(process.env.AUTH_TOKEN_EXPIRES_IN ?? '1d');
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    jwt: {
      secret: process.env.AUTH_JWT_SECRET as string,
      expiresIn,
    },
    cookie: {
      name: process.env.AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME,
      /** Kept in sync with the JWT lifetime by construction. */
      maxAge: durationToMs(expiresIn),
      /** Unreadable from JavaScript, which is the point of moving off headers. */
      httpOnly: true,
      /** Plain HTTP is only tolerated outside production. */
      secure: process.env.AUTH_COOKIE_SECURE
        ? process.env.AUTH_COOKIE_SECURE === 'true'
        : isProduction,
      /**
       * `lax` blocks the cookie on cross-site POST/PUT/DELETE, which covers the
       * common CSRF vectors while keeping top-level navigation working. Use
       * `none` (with HTTPS) only when the frontend sits on another site.
       */
      sameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax') as
        'lax' | 'strict' | 'none',
      path: '/',
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    },
    /** bcrypt work factor; 12 is a sane 2020s default. */
    bcryptRounds: Number(process.env.AUTH_BCRYPT_ROUNDS ?? 12),
  };
});
