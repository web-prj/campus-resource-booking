import { Response } from 'express';
import { AuthConfig } from '../../config';
import { AuthCookieService } from './auth-cookie.service';

const buildConfig = (overrides: Partial<AuthConfig['cookie']> = {}) =>
  ({
    jwt: { secret: 'x'.repeat(32), expiresIn: '1d' },
    cookie: {
      name: 'access_token',
      maxAge: 86_400_000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
      domain: undefined,
      ...overrides,
    },
    bcryptRounds: 12,
  }) as AuthConfig;

describe('AuthCookieService', () => {
  const mockResponse = () =>
    ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

  it('writes the token as an httpOnly cookie so scripts cannot read it', () => {
    const response = mockResponse();

    new AuthCookieService(buildConfig()).set(response, 'signed.jwt.value');

    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      'signed.jwt.value',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86_400_000,
      }),
    );
  });

  it('marks the cookie secure when configured for HTTPS', () => {
    const response = mockResponse();

    new AuthCookieService(buildConfig({ secure: true, sameSite: 'none' })).set(
      response,
      'token',
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      'token',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });

  it('clears using the same attributes, minus maxAge, so the browser matches it', () => {
    const response = mockResponse();

    new AuthCookieService(buildConfig()).clear(response);

    const [name, options] = (response.clearCookie as jest.Mock).mock.calls[0];
    expect(name).toBe('access_token');
    expect(options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      domain: undefined,
    });
    expect(options).not.toHaveProperty('maxAge');
  });

  it('honours a custom cookie name', () => {
    const response = mockResponse();

    new AuthCookieService(buildConfig({ name: 'crb_session' })).set(
      response,
      'token',
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'crb_session',
      'token',
      expect.any(Object),
    );
  });
});
