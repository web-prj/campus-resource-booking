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
      PORT: 3000,
      API_PREFIX: 'api',
      CORS_ORIGINS: 'http://localhost:3001',
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

  it('rejects SameSite=none without Secure, which browsers would discard', () => {
    const { error } = validate({
      ...baseEnv,
      AUTH_COOKIE_SAME_SITE: 'none',
      AUTH_COOKIE_SECURE: 'false',
    });

    expect(error?.message).toMatch(/AUTH_COOKIE_SECURE=true/);
  });

  it('allows SameSite=none when Secure is set', () => {
    const { error } = validate({
      ...baseEnv,
      AUTH_COOKIE_SAME_SITE: 'none',
      AUTH_COOKIE_SECURE: 'true',
    });

    expect(error).toBeUndefined();
  });

  it('treats production as secure by default', () => {
    const { error } = validate({
      ...baseEnv,
      NODE_ENV: 'production',
      AUTH_COOKIE_SAME_SITE: 'none',
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
