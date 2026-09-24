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
  let staffId: string;
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
    const staff = await register(STAFF_EMAIL, 'Check-in Staff');
    staffId = staff.id;
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

    const generationResponses = await Promise.all([
      api()
        .patch(`/api/bookings/mine/${bookingId}/check-in`)
        .set('Cookie', studentCookie),
      api()
        .patch(`/api/bookings/mine/${bookingId}/check-in`)
        .set('Cookie', studentCookie),
    ]);
    expect(generationResponses.map(({ status }) => status).sort()).toEqual([
      200, 409,
    ]);
    const requested = generationResponses.find(
      ({ status }) => status === 200,
    ) as request.Response;
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

    // Operations are ordered by date, so this far-future booking is on the
    // last page even when the database holds unrelated rows.
    const head = await api()
      .get('/api/staff/bookings/operations?pageSize=50')
      .set('Cookie', staffCookie)
      .expect(200);
    const lastPage = await api()
      .get(
        `/api/staff/bookings/operations?page=${Math.max(head.body.totalPages, 1)}&pageSize=50`,
      )
      .set('Cookie', staffCookie)
      .expect(200);
    const operation = lastPage.body.items.find(
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

    const checkInResponses = await Promise.all([
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie)
        .send({ code: requested.body.checkInCode }),
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie)
        .send({ code: requested.body.checkInCode }),
    ]);
    expect(checkInResponses.map(({ status }) => status).sort()).toEqual([
      200, 409,
    ]);
    const checkedIn = checkInResponses.find(
      ({ status }) => status === 200,
    ) as request.Response;
    expect(checkedIn.body).toMatchObject({
      status: 'checked_in',
      checkInRequested: true,
      canCheckOut: true,
      checkedInAt: expect.any(String),
    });
    expect(checkedIn.body).not.toHaveProperty('checkInCode');
    const [persistedAfterCheckIn] = await dataSource.query<
      { check_in_code: string | null }[]
    >('SELECT check_in_code FROM bookings WHERE id = $1', [bookingId]);
    expect(persistedAfterCheckIn.check_in_code).toBeNull();

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
      checkInCode: null,
      checkInRequestedAt: expect.any(String),
      checkedInAt: expect.any(String),
      checkedOutAt: expect.any(String),
    });
  });

  it('keeps overdue unresolved visits on the staff operations dashboard', async () => {
    now = new Date('2099-01-20T08:00:00.000Z'); // 15:00 ICT
    const rows = await dataSource.query<{ id: string; status: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        check_in_requested_at, checked_in_at, checked_in_by_id,
        no_show_at, no_show_by_id
      ) VALUES
        ($1, $2, '2099-01-18', '09:00', '10:00', 'checked_in',
          '2099-01-18T01:50:00.000Z', '2099-01-18T01:55:00.000Z', $3,
          NULL, NULL),
        ($1, $2, '2099-01-19', '09:00', '10:00', 'confirmed',
          NULL, NULL, NULL, NULL, NULL),
        ($1, $2, '2099-01-19', '11:00', '12:00', 'no_show',
          NULL, NULL, NULL, '2099-01-19T05:00:00.000Z', $3),
        ($1, $2, '2099-01-21', '09:00', '10:00', 'confirmed',
          NULL, NULL, NULL, NULL, NULL)
      RETURNING id, status`,
      [resourceId, studentId, staffId],
    );
    const checkedInId = rows.find(({ status }) => status === 'checked_in')?.id;
    const confirmedIds = rows
      .filter(({ status }) => status === 'confirmed')
      .map(({ id }) => id);
    const noShowId = rows.find(({ status }) => status === 'no_show')?.id;

    const operations = await api()
      .get('/api/staff/bookings/operations')
      .set('Cookie', staffCookie)
      .expect(200);
    const ids = operations.body.items.map((item: { id: string }) => item.id);

    expect(ids).toEqual([checkedInId, confirmedIds[0]]);
    expect(ids).not.toContain(noShowId);
    expect(ids).not.toContain(confirmedIds[1]);
    expect(operations.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: checkedInId, canCheckOut: true }),
        expect.objectContaining({ id: confirmedIds[0], canMarkNoShow: true }),
      ]),
    );
    expect(operations.body).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      campusDate: '2099-01-20',
    });

    const firstPage = await api()
      .get('/api/staff/bookings/operations?page=1&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    const secondPage = await api()
      .get('/api/staff/bookings/operations?page=2&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(firstPage.body).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 1,
      totalPages: 2,
      campusDate: '2099-01-20',
    });
    expect(
      [...firstPage.body.items, ...secondPage.body.items].map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([checkedInId, confirmedIds[0]]);
    const beyond = await api()
      .get('/api/staff/bookings/operations?page=3&pageSize=1')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(beyond.body).toMatchObject({ items: [], total: 2, page: 3 });

    for (const query of ['page=0', 'pageSize=0', 'pageSize=51', 'page=x']) {
      await api()
        .get(`/api/staff/bookings/operations?${query}`)
        .set('Cookie', staffCookie)
        .expect(400);
    }
  });

  it('keeps only requests that have not ended in campus time in the pending queue', async () => {
    now = new Date('2099-01-20T03:30:00.000Z'); // 10:30 ICT
    const rows = await dataSource.query<{ id: string }[]>(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status
      ) VALUES
        ($1, $2, '2099-01-19', '15:00', '16:00', 'pending'),
        ($1, $2, '2099-01-20', '07:00', '08:00', 'pending'),
        ($1, $2, '2099-01-20', '10:00', '11:00', 'pending'),
        ($1, $2, '2099-01-21', '08:00', '09:00', 'pending')
      RETURNING id`,
      [resourceId, studentId],
    );
    const idAt = (index: number) => rows[index].id;

    // Requests are ordered oldest first, so ours are on the final pages.
    const head = await api()
      .get('/api/staff/bookings/pending?pageSize=50')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(head.body).toMatchObject({ page: 1, pageSize: 50 });
    const items: { id: string; canReview: boolean }[] = [...head.body.items];
    for (const page of [head.body.totalPages - 1, head.body.totalPages]) {
      if (page <= 1) continue;
      const tail = await api()
        .get(`/api/staff/bookings/pending?page=${page}&pageSize=50`)
        .set('Cookie', staffCookie)
        .expect(200);
      items.push(...tail.body.items);
    }
    const ids = items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([idAt(2), idAt(3)]));
    expect(ids).not.toContain(idAt(0));
    expect(ids).not.toContain(idAt(1));
    expect(items.every((item) => item.canReview)).toBe(true);

    // Independent timestamp-based formulation of "has not ended yet".
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM bookings
       WHERE status = 'pending'
         AND (booking_date + end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' > $1`,
      [now.toISOString()],
    );
    expect(head.body.total).toBe(Number(count));

    await dataSource.query('DELETE FROM bookings WHERE id = ANY($1)', [
      rows.map(({ id }) => id),
    ]);
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
      .set('Cookie', studentCookie)
      .expect(403);
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
      checkInRequested: false,
      noShowAt: expect.any(String),
    });
    await api()
      .patch(`/api/staff/bookings/${bookingId}/no-show`)
      .set('Cookie', staffCookie)
      .expect(409);
  });

  it('serializes check-in against no-show at the end boundary', async () => {
    now = new Date('2099-01-20T05:50:00.000Z'); // 12:50 ICT
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentCookie)
      .send({
        resourceId,
        date: '2099-01-20',
        startTime: '13:00',
        endTime: '14:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;
    const requested = await api()
      .patch(`/api/bookings/mine/${bookingId}/check-in`)
      .set('Cookie', studentCookie)
      .expect(200);

    now = new Date('2099-01-20T07:00:00.000Z'); // 14:00 ICT
    const responses = await Promise.all([
      api()
        .patch(`/api/staff/bookings/${bookingId}/confirm-check-in`)
        .set('Cookie', staffCookie)
        .send({ code: requested.body.checkInCode }),
      api()
        .patch(`/api/staff/bookings/${bookingId}/no-show`)
        .set('Cookie', staffCookie),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const noShow = responses.find(
      ({ status }) => status === 200,
    ) as request.Response;
    expect(noShow.body).toMatchObject({ status: 'no_show' });
    const [persisted] = await dataSource.query<
      { check_in_code: string | null; status: string }[]
    >('SELECT status, check_in_code FROM bookings WHERE id = $1', [bookingId]);
    expect(persisted).toEqual({ status: 'no_show', check_in_code: null });
  });

  it('enforces lifecycle shape and chronology directly in PostgreSQL', async () => {
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
    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_code, check_in_requested_at
        ) VALUES ($1, $2, '2099-01-22', '09:00', '10:00', 'confirmed',
          '123456', '2099-01-22T01:30:00.000Z')`,
        [resourceId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_timeline',
    });

    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          check_in_requested_at, checked_in_at, checked_in_by_id,
          checked_out_at, checked_out_by_id
        ) VALUES ($1, $2, '2099-01-23', '09:00', '10:00', 'completed',
          '2099-01-23T01:50:00.000Z', '2099-01-23T02:00:00.000Z', $3,
          '2099-01-23T01:59:59.000Z', $3)`,
        [resourceId, studentId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_check_in_timeline',
    });

    await expect(
      dataSource.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          no_show_at, no_show_by_id
        ) VALUES ($1, $2, '2099-01-24', '09:00', '10:00', 'no_show',
          '2099-01-24T02:59:59.000Z', $3)`,
        [resourceId, studentId, studentId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_no_show_timeline',
    });
  });
});
