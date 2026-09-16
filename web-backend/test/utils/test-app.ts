import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CAMPUS_CLOCK, CampusClock } from '../../src/common/time/campus-clock';
import { configureApp } from '../../src/app.setup';
import { AppConfig, appConfig, AuthConfig, authConfig } from '../../src/config';

/**
 * Boots the app the same way `main.ts` does, so e2e tests exercise the real
 * pipeline (cookie parsing, validation, global guards) instead of a variant that
 * only exists in tests.
 */
export async function createTestApp(
  clock?: CampusClock,
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (clock) builder.overrideProvider(CAMPUS_CLOCK).useValue(clock);
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  const applicationConfig = app.get<AppConfig>(appConfig.KEY);
  const authenticationConfig = app.get<AuthConfig>(authConfig.KEY);

  configureApp(app, applicationConfig, authenticationConfig);

  await app.init();
  return app;
}

/** Deletes the accounts a spec created, keyed by email. */
export async function deleteUsers(
  app: INestApplication,
  emails: string[],
): Promise<void> {
  if (!emails.length) return;

  await app
    .get(DataSource)
    .query('DELETE FROM users WHERE email = ANY($1)', [
      emails.map((email) => email.toLowerCase()),
    ]);
}

/** Reads a `Set-Cookie` entry by cookie name. */
export function findSetCookie(
  headers: Record<string, unknown>,
  name: string,
): string | undefined {
  const setCookie = headers['set-cookie'];
  const values = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];

  return values.find((value) => value.startsWith(`${name}=`));
}

/** Extracts the raw cookie value, e.g. the JWT itself. */
export function cookieValue(setCookieEntry: string): string {
  return setCookieEntry.split(';')[0].split('=').slice(1).join('=');
}
