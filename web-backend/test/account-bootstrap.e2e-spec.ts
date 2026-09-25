import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AccountBootstrapService } from '../src/auth/account-bootstrap.service';
import { UserRole } from '../src/users/enums/user-role.enum';
import { createTestApp, deleteUsers } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STAFF_EMAIL = `bootstrap.staff.${RUN_ID}@usth.edu.vn`;
const ADMIN_EMAIL = `bootstrap.admin.${RUN_ID}@usth.edu.vn`;
const STUDENT_EMAIL = `bootstrap.student.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'bootstrap-password';

describe('Startup account bootstrap (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let bootstrap: AccountBootstrapService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    bootstrap = app.get(AccountBootstrapService);
  });

  afterAll(async () => {
    await deleteUsers(app, [STAFF_EMAIL, ADMIN_EMAIL, STUDENT_EMAIL]);
    await app.close();
  });

  async function roleOf(email: string) {
    const [row] = await dataSource.query<
      { role: string; is_active: boolean }[]
    >('SELECT role, is_active FROM users WHERE email = $1', [email]);
    return row;
  }

  it('creates missing staff and admin accounts that can sign in', async () => {
    for (const [role, email] of [
      [UserRole.STAFF, STAFF_EMAIL],
      [UserRole.ADMIN, ADMIN_EMAIL],
    ] as const) {
      await expect(
        bootstrap.provision(role, {
          email,
          password: PASSWORD,
          fullName: 'Bootstrap Account',
        }),
      ).resolves.toBe('created');
      await expect(roleOf(email)).resolves.toEqual({
        role,
        is_active: true,
      });

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(login.body).toMatchObject({ email, role });
    }
  });

  it('is idempotent and never resets an existing password', async () => {
    await expect(
      bootstrap.provision(UserRole.STAFF, {
        email: STAFF_EMAIL,
        password: 'a-different-password',
        fullName: 'Renamed',
      }),
    ).resolves.toBe('already-provisioned');

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: STAFF_EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('leaves an existing student account unchanged', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: STUDENT_EMAIL, password: PASSWORD, fullName: 'Student' })
      .expect(201);

    await expect(
      bootstrap.provision(UserRole.STAFF, {
        email: STUDENT_EMAIL,
        password: PASSWORD,
        fullName: 'Campus Staff',
      }),
    ).resolves.toBe('unchanged');
    await expect(roleOf(STUDENT_EMAIL)).resolves.toEqual({
      role: UserRole.STUDENT,
      is_active: true,
    });
  });
});
