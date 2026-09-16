import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

jest.setTimeout(15_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const RESOURCE_RUN_ID = Date.now().toString(36).slice(-7);
const STUDENT_ONE_EMAIL = `booking.one.${RUN_ID}@usth.edu.vn`;
const STUDENT_TWO_EMAIL = `booking.two.${RUN_ID}@usth.edu.vn`;
const STAFF_EMAIL = `booking.staff.${RUN_ID}@usth.edu.vn`;
const ADMIN_EMAIL = `booking.admin.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';
const BUILDING_ID = '10000000-0000-4000-8000-000000000001';

const CONFIRMED_DATE = '2099-01-05';
const PENDING_DATE = '2099-01-06';
const OVERLAP_DATE = '2099-01-07';
const ADJACENT_DATE = '2099-01-08';
const CONCURRENT_DATE = '2099-01-09';
const CLOSURE_DATE = '2099-01-10';
const CLOSED_DAY = '2099-01-11';
const AVAILABILITY_DATE = '2099-01-12';
const DIRECT_SQL_DATE = '2099-01-13';
const MANAGEMENT_DATE = '2099-01-14';
const APPROVAL_REVIEW_DATE = '2099-01-15';
const REJECTION_REVIEW_DATE = '2099-01-16';

describe('Booking requests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let studentOneCookie: string;
  let studentTwoCookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let studentOneId: string;
  let noApprovalResourceId: string;
  let approvalResourceId: string;
  let otherResourceId: string;
  let maintenanceResourceId: string;
  const resourceIds: string[] = [];

  const api = () => request(app.getHttpServer());

  async function register(
    email: string,
    fullName: string,
  ): Promise<{ cookie: string; id: string }> {
    const response = await api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, fullName })
      .expect(201);
    return {
      cookie: findSetCookie(response.headers, COOKIE_NAME) as string,
      id: response.body.id as string,
    };
  }

  async function login(email: string): Promise<string> {
    const response = await api()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return findSetCookie(response.headers, COOKIE_NAME) as string;
  }

  async function insertResource(
    suffix: string,
    requiresApproval: boolean,
    status: 'active' | 'maintenance' = 'active',
  ): Promise<string> {
    const [row] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO resources (
        code, name, type, status, capacity, location, requires_approval,
        operating_days, opens_at, closes_at, building_id
      ) VALUES ($1, $2, 'room', $3, 8, 'Booking E2E location', $4,
        ARRAY[1,2,3,4,5,6]::smallint[], '08:00', '18:00', $5)
      RETURNING id`,
      [
        `BK-${suffix.slice(0, 4)}-${RESOURCE_RUN_ID}`,
        `Booking ${suffix}`,
        status,
        requiresApproval,
        BUILDING_ID,
      ],
    );
    resourceIds.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    const studentOne = await register(STUDENT_ONE_EMAIL, 'Booking Student One');
    studentOneCookie = studentOne.cookie;
    studentOneId = studentOne.id;
    studentTwoCookie = (
      await register(STUDENT_TWO_EMAIL, 'Booking Student Two')
    ).cookie;
    await register(STAFF_EMAIL, 'Booking Staff');
    await register(ADMIN_EMAIL, 'Booking Admin');
    await dataSource.query(
      `UPDATE users SET role = CASE
        WHEN email = $1 THEN 'staff'::users_role_enum
        WHEN email = $2 THEN 'admin'::users_role_enum
        ELSE role END
      WHERE email IN ($1, $2)`,
      [STAFF_EMAIL, ADMIN_EMAIL],
    );
    staffCookie = await login(STAFF_EMAIL);
    adminCookie = await login(ADMIN_EMAIL);

    noApprovalResourceId = await insertResource('CONFIRM', false);
    approvalResourceId = await insertResource('PENDING', true);
    otherResourceId = await insertResource('OTHER', false);
    maintenanceResourceId = await insertResource(
      'MAINTENANCE',
      false,
      'maintenance',
    );
    await dataSource.query(
      `INSERT INTO resource_closures (resource_id, date, reason)
       VALUES ($1, $2, 'Booking E2E closure')`,
      [noApprovalResourceId, CLOSURE_DATE],
    );
  });

  afterAll(async () => {
    if (resourceIds.length) {
      await dataSource.query(
        'DELETE FROM bookings WHERE resource_id = ANY($1)',
        [resourceIds],
      );
      await dataSource.query('DELETE FROM resources WHERE id = ANY($1)', [
        resourceIds,
      ]);
    }
    await deleteUsers(app, [
      STUDENT_ONE_EMAIL,
      STUDENT_TWO_EMAIL,
      STAFF_EMAIL,
      ADMIN_EMAIL,
    ]);
    await app.close();
  });

  it('requires authentication and a student role', async () => {
    const body = {
      resourceId: noApprovalResourceId,
      date: CONFIRMED_DATE,
      startTime: '08:00',
      endTime: '09:00',
    };
    await api().post('/api/bookings').send(body).expect(401);
    await api()
      .post('/api/bookings')
      .set('Cookie', staffCookie)
      .send(body)
      .expect(403);
    await api()
      .post('/api/bookings')
      .set('Cookie', adminCookie)
      .send(body)
      .expect(403);
  });

  it('creates confirmed and pending bookings from resource policy', async () => {
    const confirmed = await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: noApprovalResourceId,
        date: CONFIRMED_DATE,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    expect(confirmed.body).toMatchObject({
      resourceId: noApprovalResourceId,
      requesterId: studentOneId,
      date: CONFIRMED_DATE,
      startTime: '09:00',
      endTime: '10:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      status: 'confirmed',
    });

    const pending = await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: approvalResourceId,
        date: PENDING_DATE,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    expect(pending.body).toMatchObject({
      requesterId: studentOneId,
      status: 'pending',
    });
  });

  it.each([
    [{ date: '2026-02-30' }, 400],
    [{ date: '2026-09-14' }, 400],
    [{ startTime: '10:00', endTime: '10:00' }, 400],
    [{ startTime: '11:00', endTime: '10:00' }, 400],
    [{ startTime: '09:30' }, 400],
    [{ resourceId: 'not-a-uuid' }, 400],
    [{ unknown: true }, 400],
  ])('rejects invalid booking input %p', async (overrides, status) => {
    await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: noApprovalResourceId,
        date: CONFIRMED_DATE,
        startTime: '14:00',
        endTime: '15:00',
        ...overrides,
      })
      .expect(status);
  });

  it('rejects unknown and operationally unavailable resources', async () => {
    const base = {
      date: CLOSURE_DATE,
      startTime: '09:00',
      endTime: '10:00',
    };
    const cases: Array<[string, typeof base, number, string]> = [
      [
        '99999999-9999-4999-8999-999999999999',
        { ...base, date: CONFIRMED_DATE },
        404,
        'RESOURCE_NOT_FOUND',
      ],
      [
        maintenanceResourceId,
        { ...base, date: CONFIRMED_DATE },
        409,
        'RESOURCE_UNAVAILABLE',
      ],
      [noApprovalResourceId, base, 409, 'RESOURCE_UNAVAILABLE'],
      [
        noApprovalResourceId,
        { ...base, date: CLOSED_DAY },
        409,
        'RESOURCE_UNAVAILABLE',
      ],
      [
        noApprovalResourceId,
        { ...base, date: CONFIRMED_DATE, startTime: '07:00', endTime: '08:00' },
        409,
        'RESOURCE_UNAVAILABLE',
      ],
    ];

    for (const [resourceId, interval, status, code] of cases) {
      const response = await api()
        .post('/api/bookings')
        .set('Cookie', studentOneCookie)
        .send({ resourceId, ...interval })
        .expect(status);
      expect(response.body.code).toBe(code);
    }
  });

  it('rejects exact, partial, contained, and enveloping overlaps', async () => {
    const initial = {
      resourceId: noApprovalResourceId,
      date: OVERLAP_DATE,
      startTime: '10:00',
      endTime: '12:00',
    };
    await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send(initial)
      .expect(201);

    for (const [startTime, endTime] of [
      ['10:00', '12:00'],
      ['09:00', '11:00'],
      ['10:00', '11:00'],
      ['09:00', '13:00'],
      ['11:00', '13:00'],
    ]) {
      const response = await api()
        .post('/api/bookings')
        .set('Cookie', studentTwoCookie)
        .send({ ...initial, startTime, endTime })
        .expect(409);
      expect(response.body.code).toBe('BOOKING_OVERLAP');
    }
  });

  it('allows adjacent ranges and the same interval on another resource', async () => {
    for (const [resourceId, startTime, endTime] of [
      [noApprovalResourceId, '09:00', '11:00'],
      [noApprovalResourceId, '11:00', '13:00'],
      [otherResourceId, '09:00', '11:00'],
    ]) {
      await api()
        .post('/api/bookings')
        .set('Cookie', studentOneCookie)
        .send({ resourceId, date: ADJACENT_DATE, startTime, endTime })
        .expect(201);
    }
  });

  it('allows exactly one concurrent request for the same interval', async () => {
    const body = {
      resourceId: noApprovalResourceId,
      date: CONCURRENT_DATE,
      startTime: '14:00',
      endTime: '16:00',
    };
    const responses = await Promise.all([
      api().post('/api/bookings').set('Cookie', studentOneCookie).send(body),
      api().post('/api/bookings').set('Cookie', studentTwoCookie).send(body),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('BOOKING_OVERLAP');

    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM bookings
       WHERE resource_id = $1 AND booking_date = $2
         AND start_time = '14:00' AND end_time = '16:00'`,
      [noApprovalResourceId, CONCURRENT_DATE],
    );
    expect(count).toBe('1');
  });

  it('lists owned bookings, protects details, and releases cancelled slots', async () => {
    const created = await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: noApprovalResourceId,
        date: MANAGEMENT_DATE,
        startTime: '13:00',
        endTime: '15:00',
      })
      .expect(201);
    const bookingId = created.body.id as string;

    const timeline = await api()
      .get('/api/bookings/mine')
      .set('Cookie', studentOneCookie)
      .expect(200);
    expect(timeline.body.upcoming).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: bookingId,
          status: 'confirmed',
          canCancel: true,
          resource: expect.objectContaining({
            id: noApprovalResourceId,
            name: 'Booking CONFIRM',
          }),
        }),
      ]),
    );

    await api()
      .get(`/api/bookings/mine/${bookingId}`)
      .set('Cookie', studentTwoCookie)
      .expect(404);
    await api()
      .patch(`/api/bookings/mine/${bookingId}/cancel`)
      .set('Cookie', studentTwoCookie)
      .expect(404);

    const cancelled = await api()
      .patch(`/api/bookings/mine/${bookingId}/cancel`)
      .set('Cookie', studentOneCookie)
      .expect(200);
    expect(cancelled.body).toMatchObject({
      id: bookingId,
      status: 'cancelled',
      canCancel: false,
    });
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));

    await api()
      .patch(`/api/bookings/mine/${bookingId}/cancel`)
      .set('Cookie', studentOneCookie)
      .expect(409);

    const afterCancellation = await api()
      .get('/api/bookings/mine')
      .set('Cookie', studentOneCookie)
      .expect(200);
    expect(
      afterCancellation.body.upcoming.some(
        (booking: { id: string }) => booking.id === bookingId,
      ),
    ).toBe(false);
    expect(afterCancellation.body.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bookingId, status: 'cancelled' }),
      ]),
    );

    const availability = await api()
      .get(
        `/api/resources/${noApprovalResourceId}/availability?date=${MANAGEMENT_DATE}`,
      )
      .set('Cookie', studentTwoCookie)
      .expect(200);
    expect(availability.body.slots).toEqual(
      expect.arrayContaining([
        { startTime: '13:00', endTime: '14:00' },
        { startTime: '14:00', endTime: '15:00' },
      ]),
    );
  });

  it('staff reviews pending requests and rejected slots become available', async () => {
    const approveRequest = await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: approvalResourceId,
        date: APPROVAL_REVIEW_DATE,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const rejectRequest = await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: approvalResourceId,
        date: REJECTION_REVIEW_DATE,
        startTime: '10:00',
        endTime: '11:00',
      })
      .expect(201);

    await api()
      .get('/api/staff/bookings/pending')
      .set('Cookie', studentOneCookie)
      .expect(403);
    await api()
      .patch(`/api/staff/bookings/${approveRequest.body.id}/approve`)
      .set('Cookie', adminCookie)
      .expect(403);

    const queue = await api()
      .get('/api/staff/bookings/pending')
      .set('Cookie', staffCookie)
      .expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: approveRequest.body.id,
          status: 'pending',
          requester: expect.objectContaining({ id: studentOneId }),
          resource: expect.objectContaining({ id: approvalResourceId }),
        }),
        expect.objectContaining({ id: rejectRequest.body.id }),
      ]),
    );

    const detail = await api()
      .get(`/api/staff/bookings/${approveRequest.body.id}`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(detail.body).toMatchObject({
      id: approveRequest.body.id,
      status: 'pending',
      reviewedAt: null,
      reviewer: null,
    });

    const schedule = await api()
      .get(
        `/api/staff/bookings/resources/${approvalResourceId}/schedule?date=${APPROVAL_REVIEW_DATE}`,
      )
      .set('Cookie', staffCookie)
      .expect(200);
    expect(schedule.body.bookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approveRequest.body.id }),
      ]),
    );

    const approved = await api()
      .patch(`/api/staff/bookings/${approveRequest.body.id}/approve`)
      .set('Cookie', staffCookie)
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'confirmed',
      reviewedAt: expect.any(String),
      rejectionReason: null,
      reviewer: expect.objectContaining({ email: STAFF_EMAIL }),
    });
    await api()
      .patch(`/api/staff/bookings/${approveRequest.body.id}/approve`)
      .set('Cookie', staffCookie)
      .expect(409);

    await api()
      .patch(`/api/staff/bookings/${rejectRequest.body.id}/reject`)
      .set('Cookie', staffCookie)
      .send({ reason: ' ' })
      .expect(400);
    const rejected = await api()
      .patch(`/api/staff/bookings/${rejectRequest.body.id}/reject`)
      .set('Cookie', staffCookie)
      .send({ reason: 'Laboratory reserved for a scheduled practical.' })
      .expect(200);
    expect(rejected.body).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Laboratory reserved for a scheduled practical.',
      reviewedAt: expect.any(String),
      reviewer: expect.objectContaining({ email: STAFF_EMAIL }),
    });

    const studentTimeline = await api()
      .get('/api/bookings/mine')
      .set('Cookie', studentOneCookie)
      .expect(200);
    expect(studentTimeline.body.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: rejectRequest.body.id,
          status: 'rejected',
          canCancel: false,
          rejectionReason: 'Laboratory reserved for a scheduled practical.',
        }),
      ]),
    );

    const availability = await api()
      .get(
        `/api/resources/${approvalResourceId}/availability?date=${REJECTION_REVIEW_DATE}`,
      )
      .set('Cookie', studentTwoCookie)
      .expect(200);
    expect(availability.body.slots).toContainEqual({
      startTime: '10:00',
      endTime: '11:00',
    });
  });

  it('removes occupied slots from availability and interval discovery', async () => {
    await api()
      .post('/api/bookings')
      .set('Cookie', studentOneCookie)
      .send({
        resourceId: noApprovalResourceId,
        date: AVAILABILITY_DATE,
        startTime: '09:00',
        endTime: '11:00',
      })
      .expect(201);

    const availability = await api()
      .get(
        `/api/resources/${noApprovalResourceId}/availability?date=${AVAILABILITY_DATE}`,
      )
      .set('Cookie', studentTwoCookie)
      .expect(200);
    expect(availability.body.slots).toHaveLength(8);
    expect(availability.body.slots).not.toEqual(
      expect.arrayContaining([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
      ]),
    );

    const directory = await api()
      .get(
        `/api/resources?date=${AVAILABILITY_DATE}&startTime=09:00&endTime=10:00`,
      )
      .set('Cookie', studentTwoCookie)
      .expect(200);
    expect(
      directory.body.items.some(
        (item: { id: string }) => item.id === noApprovalResourceId,
      ),
    ).toBe(false);
  });

  it('enforces booking shape and overlap directly in PostgreSQL', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
         VALUES ($1, $2, $3, '10:00', '09:00', 'confirmed')`,
        [noApprovalResourceId, studentOneId, DIRECT_SQL_DATE],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_time_order',
    });
    await expect(
      dataSource.query(
        `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
         VALUES ($1, $2, $3, '09:30', '10:30', 'confirmed')`,
        [noApprovalResourceId, studentOneId, DIRECT_SQL_DATE],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_bookings_whole_hour',
    });

    await dataSource.query(
      `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
       VALUES ($1, $2, $3, '09:00', '11:00', 'pending')`,
      [noApprovalResourceId, studentOneId, DIRECT_SQL_DATE],
    );
    await expect(
      dataSource.query(
        `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
         VALUES ($1, $2, $3, '10:00', '12:00', 'confirmed')`,
        [noApprovalResourceId, studentOneId, DIRECT_SQL_DATE],
      ),
    ).rejects.toMatchObject({
      code: '23P01',
      constraint: 'EXCL_bookings_resource_period_blocking',
    });
  });
});
