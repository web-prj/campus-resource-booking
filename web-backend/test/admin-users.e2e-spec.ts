import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_EMAIL = `users.admin.${RUN_ID}@usth.edu.vn`;
const OTHER_ADMIN_EMAIL = `users.other-admin.${RUN_ID}@usth.edu.vn`;
const STUDENT_EMAIL = `users.student.${RUN_ID}@usth.edu.vn`;
const SEARCH_EMAIL = `unique.directory.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

describe('Admin user and role management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminCookie: string;
  let studentCookie: string;
  let otherAdminCookie: string;
  let adminId: string;
  let otherAdminId: string;
  let studentId: string;
  let searchId: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    for (const [email, fullName] of [
      [ADMIN_EMAIL, 'User Directory Admin'],
      [OTHER_ADMIN_EMAIL, 'Second Directory Admin'],
      [STUDENT_EMAIL, 'Directory Student'],
      [SEARCH_EMAIL, 'Unique Search Person'],
    ]) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, fullName })
        .expect(201);
    }

    await dataSource.query(
      `UPDATE users SET role = 'admin'::users_role_enum WHERE email = ANY($1)`,
      [[ADMIN_EMAIL, OTHER_ADMIN_EMAIL]],
    );
    const users = await dataSource.query<{ id: string; email: string }[]>(
      `SELECT id, email FROM users WHERE email = ANY($1)`,
      [[ADMIN_EMAIL, OTHER_ADMIN_EMAIL, STUDENT_EMAIL, SEARCH_EMAIL]],
    );
    const ids = Object.fromEntries(users.map((user) => [user.email, user.id]));
    adminId = ids[ADMIN_EMAIL];
    otherAdminId = ids[OTHER_ADMIN_EMAIL];
    studentId = ids[STUDENT_EMAIL];
    searchId = ids[SEARCH_EMAIL];

    adminCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: ADMIN_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    otherAdminCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: OTHER_ADMIN_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
    studentCookie = findSetCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: STUDENT_EMAIL, password: PASSWORD })
          .expect(200)
      ).headers,
      COOKIE_NAME,
    ) as string;
  });

  afterAll(async () => {
    await deleteUsers(app, [
      ADMIN_EMAIL,
      OTHER_ADMIN_EMAIL,
      STUDENT_EMAIL,
      SEARCH_EMAIL,
    ]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('requires authentication and an administrator role', async () => {
    await api().get('/api/admin/users').expect(401);
    await api()
      .get('/api/admin/users')
      .set('Cookie', studentCookie)
      .expect(403);
    await api()
      .patch(`/api/admin/users/${searchId}/role`)
      .set('Cookie', studentCookie)
      .send({ role: 'staff' })
      .expect(403);
  });

  it('searches and filters accounts without exposing password data', async () => {
    const response = await api()
      .get('/api/admin/users')
      .query({ q: 'Unique Search', role: 'student', isActive: true })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      items: [
        {
          id: searchId,
          email: SEARCH_EMAIL,
          fullName: 'Unique Search Person',
          role: 'student',
          isActive: true,
        },
      ],
    });
    expect(response.body.items[0]).not.toHaveProperty('passwordHash');
  });

  it('validates list filters and mutation bodies strictly', async () => {
    await api()
      .get('/api/admin/users')
      .query({ role: 'owner' })
      .set('Cookie', adminCookie)
      .expect(400);
    await api()
      .patch(`/api/admin/users/${searchId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false, role: 'admin' })
      .expect(400);
  });

  it('assigns staff and administrator roles', async () => {
    await api()
      .patch(`/api/admin/users/${searchId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'staff' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: searchId, role: 'staff' }),
      );

    await api()
      .patch(`/api/admin/users/${searchId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'admin' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: searchId, role: 'admin' }),
      );
  });

  it('prevents administrators from changing their own role or access', async () => {
    await api()
      .patch(`/api/admin/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'student' })
      .expect(400);
    await api()
      .patch(`/api/admin/users/${adminId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
      .expect(400);
  });

  it('applies role changes to an existing session immediately', async () => {
    await api()
      .patch(`/api/admin/users/${otherAdminId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'staff' })
      .expect(200);

    await api()
      .get('/api/admin/users')
      .set('Cookie', otherAdminCookie)
      .expect(403);
  });

  it('deactivates an account, invalidates its session, and blocks login', async () => {
    await api()
      .patch(`/api/admin/users/${studentId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: studentId, isActive: false }),
      );

    await api().get('/api/auth/me').set('Cookie', studentCookie).expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: PASSWORD })
      .expect(401)
      .expect(({ body }) =>
        expect(body.message).toBe('Invalid email or password'),
      );

    await api()
      .patch(`/api/admin/users/${studentId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: true })
      .expect(200);
    await api()
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('returns 404 for an unknown target', async () => {
    await api()
      .patch('/api/admin/users/99999999-9999-4999-8999-999999999999/role')
      .set('Cookie', adminCookie)
      .send({ role: 'staff' })
      .expect(404);
  });
});
