import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

jest.setTimeout(15_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STUDENT_EMAIL = `checkin.student.${RUN_ID}@usth.edu.vn`;
const STAFF_EMAIL = `checkin.staff.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';
const BUILDING_ID = '10000000-0000-4000-8000-000000000001';

describe('Check-in and checkout (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let studentCookie: string;
  let staffCookie: string;
  let studentId: string;
  let resourceId: string;
  let now = new Date('2099-01-20T01:50:00.000Z'); // 08:50 ICT

  const api = () => request(app.getHttpServer());

  async function register(email: string, fullName: string) {
    const response = await api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, fullName })
      .expect(201);
    return {
      id: response.body.id as string,
      cookie: findSetCookie(response.headers, COOKIE_NAME) as string,
    };
  }

  async function login(email: string): Promise<string> {
    const response = await api()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return findSetCookie(response.headers, COOKIE_NAME) as string;
  }

  beforeAll(async () => {
    app = await createTestApp(() => now);
    dataSource = app.get(DataSource);
    const student = await register(STUDENT_EMAIL, 'Check-in Student');
    studentId = student.id;
    studentCookie = student.cookie;
    await register(STAFF_EMAIL, 'Check-in Staff');
    await dataSource.query(
      `UPDATE users SET role = 'staff'::users_role_enum WHERE email = $1`,
      [STAFF_EMAIL],
    );
    staffCookie = await login(STAFF_EMAIL);
    const [resource] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO resources (
        code, name, type, status, capacity, location, requires_approval,
        operating_days, opens_at, closes_at, building_id
      ) VALUES ($1, 'Check-in Room', 'room', 'active', 8, 'Operations desk', false,
        ARRAY[1,2,3,4,5,6]::smallint[], '08:00', '18:00', $2)
      RETURNING id`,
      [`CI-${Date.now().toString(36).slice(-7)}`, BUILDING_ID],
    );
    resourceId = resource.id;
  });

  afterAll(async () => {
    if (resourceId) {
      await dataSource.query('DELETE FROM bookings WHERE resource_id = $1', [
        resourceId,
      ]);
      await dataSource.query('DELETE FROM resources WHERE id = $1', [
        resourceId,
      ]);
    }
    await deleteUsers(app, [STUDENT_EMAIL, STAFF_EMAIL]);
    await app.close();
  });

  it('generates one code, confirms check-in, and completes checkout', async () => {
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;

    await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', staffCookie)
      .expect(403);

    const requested = await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(requested.body).toMatchObject({
      id: bookingId,
      status: 'confirmed',
      canCancel: false,
      canRequestCheckIn: false,
      checkInCode: expect.stringMatching(/^\d{6}$/),
      checkInRequestedAt: expect.any(String),
    });

    await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', studentCookie)
      .expect(409);

    const operations = await api()
      .get('/api/staff/bookings/operations')
      .set('Cookie', staffCookie)
      .expect(200);
    const operation = operations.body.items.find(
      (item: { id: string }) => item.id === bookingId,
    );
    expect(operation).toMatchObject({
      checkInRequested: true,
      canConfirmCheckIn: true,
    });
    expect(operation).not.toHaveProperty('checkInCode');

    await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .send({ code: '000000' })
      .expect(409);

    const checkedIn = await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .send({ code: requested.body.checkInCode })
      .expect(200);
    expect(checkedIn.body).toMatchObject({
      status: 'checked_in',
      canCheckOut: true,
      checkedInAt: expect.any(String),
    });

    await api()
      .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
      .set('Cookie', staffCookie)
      .send({ code: requested.body.checkInCode })
      .expect(409);

    const completed = await api()
      .patch(`/api/staff/bookings/${bookingId}/check-out`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(completed.body).toMatchObject({
      status: 'completed',
      canCheckOut: false,
      checkedOutAt: expect.any(String),
    });
    await api()
      .patch(`/api/staff/bookings/${bookingId}/check-out`)
      .set('Cookie', staffCookie)
      .expect(409);

    const studentDetail = await api()
      .get(`/api/bookings/mine/${bookingId}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(studentDetail.body).toMatchObject({
      status: 'completed',
      checkedInAt: expect.any(String),
      checkedOutAt: expect.any(String),
    });
  });

  it('rejects early check-in and permits no-show only after the booking ends', async () => {
    now = new Date('2099-01-20T02:00:00.000Z'); // 09:00 ICT
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '11:00',
        endTime: '12:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;

    await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', studentCookie)
      .expect(409);
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);

    now = new Date('2099-01-20T05:00:00.000Z'); // 12:00 ICT
    const noShow = await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(noShow.body).toMatchObject({
      status: 'no_show',
      noShowAt: expect.any(String),
    });
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);
  });

  it('enforces lifecycle shape directly in PostgreSQL', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_code
        ) VALUES ($1, $2, '2099-01-21', '09:00', '10:00', 'confirmed', '123456')`,
        [resourceId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_request',
    });
  });
});
