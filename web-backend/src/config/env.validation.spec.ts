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

  it('rejects a malformed token lifetime', () => {
    expect(
      validate({ ...baseEnv, AUTH_TOKEN_EXPIRES_IN: 'soon' }).error,
    ).toBeDefined();
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
});
