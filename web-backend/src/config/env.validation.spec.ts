import { envValidationSchema } from './env.validation';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'web_backend',
  AUTH_JWT_SECRET: 'a'.repeat(32),
};

const validate = (env: Record<string, unknown>) =>
  envValidationSchema.validate(env, { abortEarly: false });

describe('envValidationSchema', () => {
  it('accepts a minimal valid environment and fills in defaults', () => {
    const { error, value } = validate(baseEnv);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 18320,
      API_PREFIX: 'api',
      CORS_ORIGINS: 'http://localhost:18321',
      DB_PORT: 18322,
      AUTH_TOKEN_EXPIRES_IN: '1d',
      AUTH_COOKIE_NAME: 'access_token',
      AUTH_COOKIE_SAME_SITE: 'lax',
      AUTH_BCRYPT_ROUNDS: 12,
    });
  });

  it('requires a JWT secret long enough to resist brute force', () => {
    expect(
      validate({ ...baseEnv, AUTH_JWT_SECRET: 'short' }).error,
    ).toBeDefined();
    expect(
      validate({ ...baseEnv, AUTH_JWT_SECRET: undefined }).error,
    ).toBeDefined();
  });

  it('rejects SameSite=none until unsafe requests have CSRF protection', () => {
    expect(
      validate({
        ...baseEnv,
        AUTH_COOKIE_SAME_SITE: 'none',
        AUTH_COOKIE_SECURE: 'true',
      }).error,
    ).toBeDefined();
  });

  it('treats production cookies as secure by default', () => {
    const { error } = validate({
      ...baseEnv,
      NODE_ENV: 'production',
    });

    expect(error).toBeUndefined();
  });

  it('rejects explicitly insecure cookies in production', () => {
    const { error } = validate({
      ...baseEnv,
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'false',
    });

    expect(error?.message).toMatch(/requires AUTH_COOKIE_SECURE=true/);
  });

  it('rejects schema synchronization outside development', () => {
    expect(
      validate({ ...baseEnv, NODE_ENV: 'test', DB_SYNCHRONIZE: true }).error
        ?.message,
    ).toMatch(/allowed only in development/);
    expect(
      validate({ ...baseEnv, NODE_ENV: 'production', DB_SYNCHRONIZE: true })
        .error?.message,
    ).toMatch(/allowed only in development/);
    expect(
      validate({ ...baseEnv, NODE_ENV: 'development', DB_SYNCHRONIZE: true })
        .error,
    ).toBeUndefined();
  });

  it('rejects the example JWT secret in production', () => {
    const { error } = validate({
      ...baseEnv,
      NODE_ENV: 'production',
      AUTH_JWT_SECRET: 'change-me-in-production-min-32-characters-long',
    });

    expect(error?.message).toMatch(/generated AUTH_JWT_SECRET/);
  });

  it('rejects malformed, zero, and numerically unsafe token lifetimes', () => {
    for (const lifetime of ['soon', '0', '0s', '999999999999999999999d']) {
      expect(
        validate({ ...baseEnv, AUTH_TOKEN_EXPIRES_IN: lifetime }).error,
      ).toBeDefined();
    }
    expect(
      validate({ ...baseEnv, AUTH_TOKEN_EXPIRES_IN: '7d' }).error,
    ).toBeUndefined();
  });

  it('keeps the bcrypt cost within a sane range', () => {
    expect(validate({ ...baseEnv, AUTH_BCRYPT_ROUNDS: 4 }).error).toBeDefined();
    expect(
      validate({ ...baseEnv, AUTH_BCRYPT_ROUNDS: 20 }).error,
    ).toBeDefined();
  });

  it('reports every problem at once, not just the first', () => {
    const { error } = validate({ AUTH_JWT_SECRET: 'short' });

    expect(error?.details.length).toBeGreaterThan(1);
  });

  it('accepts an optional, normalized USTH bootstrap administrator email', () => {
    expect(validate(baseEnv).value.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
    expect(
      validate({ ...baseEnv, BOOTSTRAP_ADMIN_EMAIL: '' }).error,
    ).toBeUndefined();

    const { error, value } = validate({
      ...baseEnv,
      BOOTSTRAP_ADMIN_EMAIL: '  First.Admin@USTH.edu.vn ',
    });
    expect(error).toBeUndefined();
    expect(value.BOOTSTRAP_ADMIN_EMAIL).toBe('first.admin@usth.edu.vn');
  });

  it('rejects a bootstrap administrator email outside the exact USTH domain', () => {
    for (const email of [
      'admin@gmail.com',
      'admin@mail.usth.edu.vn',
      'admin@usth.edu.vn.evil.com',
      'not-an-email',
      '@usth.edu.vn',
    ]) {
      expect(
        validate({ ...baseEnv, BOOTSTRAP_ADMIN_EMAIL: email }).error?.message,
      ).toMatch(/BOOTSTRAP_ADMIN_EMAIL/);
    }
  });

  it('accepts optional bootstrap admin and staff accounts', () => {
    const { error, value } = validate({
      ...baseEnv,
      BOOTSTRAP_ADMIN_EMAIL: 'first.admin@usth.edu.vn',
      BOOTSTRAP_ADMIN_PASSWORD: 'admin-password',
      BOOTSTRAP_ADMIN_NAME: '',
      BOOTSTRAP_STAFF_EMAIL: ' Desk.Staff@USTH.edu.vn',
      BOOTSTRAP_STAFF_PASSWORD: 'staff-password',
      BOOTSTRAP_STAFF_NAME: 'Lan Pham',
    });
    expect(error).toBeUndefined();
    expect(value.BOOTSTRAP_STAFF_EMAIL).toBe('desk.staff@usth.edu.vn');
    expect(
      validate({
        ...baseEnv,
        BOOTSTRAP_STAFF_EMAIL: '',
        BOOTSTRAP_STAFF_PASSWORD: '',
      }).error,
    ).toBeUndefined();
  });

  it('rejects bootstrap staff emails outside the exact USTH domain', () => {
    expect(
      validate({ ...baseEnv, BOOTSTRAP_STAFF_EMAIL: 'staff@gmail.com' }).error
        ?.message,
    ).toMatch(/BOOTSTRAP_STAFF_EMAIL/);
  });

  it('applies registration password rules to bootstrap passwords', () => {
    for (const password of ['short', 'é'.repeat(37)]) {
      expect(
        validate({
          ...baseEnv,
          BOOTSTRAP_ADMIN_EMAIL: 'first.admin@usth.edu.vn',
          BOOTSTRAP_ADMIN_PASSWORD: password,
        }).error?.message,
      ).toMatch(/BOOTSTRAP_ADMIN_PASSWORD must be 8 characters to 72 bytes/);
    }
  });

  it('rejects a bootstrap password or name without its email', () => {
    expect(
      validate({ ...baseEnv, BOOTSTRAP_STAFF_PASSWORD: 'staff-password' }).error
        ?.message,
    ).toMatch(/BOOTSTRAP_STAFF_PASSWORD and BOOTSTRAP_STAFF_NAME require/);
    expect(
      validate({ ...baseEnv, BOOTSTRAP_ADMIN_NAME: 'Admin' }).error?.message,
    ).toMatch(/require BOOTSTRAP_ADMIN_EMAIL/);
  });

  it('rejects the same bootstrap email for admin and staff', () => {
    expect(
      validate({
        ...baseEnv,
        BOOTSTRAP_ADMIN_EMAIL: 'same@usth.edu.vn',
        BOOTSTRAP_STAFF_EMAIL: 'Same@usth.edu.vn',
      }).error?.message,
    ).toMatch(/must differ/);
  });
});
