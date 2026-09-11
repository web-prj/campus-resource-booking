import { Inject, Injectable } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { AuthConfig, authConfig } from '../../config';

/**
 * The single place that knows how the session cookie is written and cleared.
 * Controllers call `set`/`clear`, so the flags can never drift between login,
 * register, and logout.
 */
@Injectable()
export class AuthCookieService {
  constructor(@Inject(authConfig.KEY) private readonly config: AuthConfig) {}

  get name(): string {
    return this.config.cookie.name;
  }

  set(response: Response, token: string): void {
    response.cookie(this.name, token, this.options());
  }

  /**
   * Clearing must repeat the attributes used when setting, otherwise the browser
   * treats it as a different cookie and leaves the original in place.
   */
  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.options();
    response.clearCookie(this.name, options);
  }

  private options(): CookieOptions {
    const { maxAge, httpOnly, secure, sameSite, path, domain } =
      this.config.cookie;

    return { maxAge, httpOnly, secure, sameSite, path, domain };
  }
}
