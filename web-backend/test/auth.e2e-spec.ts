import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  cookieValue,
  createTestApp,
  deleteUsers,
  findSetCookie,
} from './utils/test-app';

// Unique per run so repeated runs never collide on the unique email constraint.
const EMAIL = `e2e.${Date.now()}@usth.edu.vn`;
const PASSWORD = 'password123';
const FULL_NAME = 'E2E Student';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const createdEmails: string[] = [EMAIL];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await deleteUsers(app, createdEmails);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  describe('POST /api/auth/register', () => {
    it('rejects a non-@usth.edu.vn domain with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: 'someone@gmail.com',
          password: PASSWORD,
          fullName: FULL_NAME,
        })
        .expect(400);
    });

    it('rejects a usth.edu.vn subdomain with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: 'someone@mail.usth.edu.vn',
          password: PASSWORD,
          fullName: FULL_NAME,
        })
        .expect(400);
    });

    it('rejects an overlong university email with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: `${'a'.repeat(244)}@usth.edu.vn`,
          password: PASSWORD,
          fullName: FULL_NAME,
        })
        .expect(400);
    });

    it('rejects null bytes in persisted registration text with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: `null.${Date.now()}@usth.edu.vn`,
          password: PASSWORD,
          fullName: 'Campus\u0000Student',
        })
        .expect(400);
    });

    it('rejects a password shorter than 8 chars with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: `short.${Date.now()}@usth.edu.vn`,
          password: 'short',
          fullName: FULL_NAME,
        })
        .expect(400);
    });

    it('rejects a password longer than 72 UTF-8 bytes with 400', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: `long-password.${Date.now()}@usth.edu.vn`,
          password: 'ế'.repeat(25),
          fullName: FULL_NAME,
        })
        .expect(400);
    });

    it('rejects unknown properties, so role cannot be self-assigned', async () => {
      await api()
        .post('/api/auth/register')
        .send({
          email: EMAIL,
          password: PASSWORD,
          fullName: FULL_NAME,
          role: 'admin',
        })
        .expect(400);
    });

    it('registers a student, sets an httpOnly cookie, and keeps the token out of the body', async () => {
      const response = await api()
        .post('/api/auth/register')
        .send({ email: EMAIL, password: PASSWORD, fullName: FULL_NAME })
        .expect(201);

      const setCookie = findSetCookie(response.headers, COOKIE_NAME);
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\//i);
      expect(setCookie).toMatch(/Max-Age=\d+/i);

      expect(response.body).toMatchObject({
        email: EMAIL.toLowerCase(),
        fullName: FULL_NAME,
        role: 'student',
      });
      expect(response.body.id).toEqual(expect.any(String));

      // Neither the token nor the hash may appear in the response body.
      const serialized = JSON.stringify(response.body);
      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.passwordHash).toBeUndefined();
      expect(serialized).not.toContain('$2b$');
      expect(serialized).not.toContain(cookieValue(setCookie as string));
    });

    it('allows exactly one concurrent registration for an email', async () => {
      const email = `concurrent.${Date.now()}@usth.edu.vn`;
      createdEmails.push(email);
      const payload = { email, password: PASSWORD, fullName: FULL_NAME };

      const responses = await Promise.all([
        api().post('/api/auth/register').send(payload),
        api().post('/api/auth/register').send(payload),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    });

    it('rejects a duplicate email with 409', async () => {
      await api()
        .post('/api/auth/register')
        .send({ email: EMAIL, password: PASSWORD, fullName: FULL_NAME })
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects an overlong university email with 400', async () => {
      await api()
        .post('/api/auth/login')
        .send({ email: `${'a'.repeat(244)}@usth.edu.vn`, password: PASSWORD })
        .expect(400);
    });

    it('rejects a password longer than 72 UTF-8 bytes with 400', async () => {
      await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: 'ế'.repeat(25) })
        .expect(400);
    });

    it('rejects a wrong password with 401 and sets no cookie', async () => {
      const response = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: 'wrong-password' })
        .expect(401);

      expect(findSetCookie(response.headers, COOKIE_NAME)).toBeUndefined();
    });

    it('rejects an unknown account with the same 401 message', async () => {
      const unknown = await api()
        .post('/api/auth/login')
        .send({ email: `nobody.${Date.now()}@usth.edu.vn`, password: PASSWORD })
        .expect(401);

      const wrongPassword = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: 'wrong-password' })
        .expect(401);

      expect(unknown.body.message).toBe(wrongPassword.body.message);
    });

    it('is case-insensitive on the email and issues a token whose lifetime matches the cookie', async () => {
      const response = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL.toUpperCase(), password: PASSWORD })
        .expect(200);

      const setCookie = findSetCookie(response.headers, COOKIE_NAME) as string;
      const payload = JSON.parse(
        Buffer.from(
          cookieValue(setCookie).split('.')[1],
          'base64url',
        ).toString(),
      );

      expect(payload.email).toBe(EMAIL.toLowerCase());
      expect(payload.role).toBe('student');

      const maxAgeSeconds = Number(/Max-Age=(\d+)/i.exec(setCookie)?.[1]);
      expect(payload.exp - payload.iat).toBe(maxAgeSeconds);
    });
  });

  describe('GET /api/auth/me', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const response = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD });
      sessionCookie = findSetCookie(response.headers, COOKIE_NAME) as string;
    });

    it('returns 401 without a cookie', async () => {
      await api().get('/api/auth/me').expect(401);
    });

    it('returns 401 with a malformed cookie', async () => {
      await api()
        .get('/api/auth/me')
        .set('Cookie', `${COOKIE_NAME}=not-a-real-token`)
        .expect(401);
    });

    it('ignores a bearer header, since the cookie is the only accepted transport', async () => {
      await api()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${cookieValue(sessionCookie)}`)
        .expect(401);
    });

    it('returns the current user when the cookie is sent', async () => {
      const response = await api()
        .get('/api/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        email: EMAIL.toLowerCase(),
        fullName: FULL_NAME,
        role: 'student',
      });
      expect(response.body.passwordHash).toBeUndefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('requires a session', async () => {
      await api().post('/api/auth/logout').expect(401);
    });

    it('expires the cookie so the browser drops it', async () => {
      const login = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(200);
      const sessionCookie = findSetCookie(login.headers, COOKIE_NAME) as string;

      const logout = await api()
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(204);

      const cleared = findSetCookie(logout.headers, COOKIE_NAME) as string;
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
      expect(cookieValue(cleared)).toBe('');
    });
  });
});
