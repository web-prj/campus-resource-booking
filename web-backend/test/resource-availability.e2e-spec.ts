import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STUDENT_EMAIL = `availability.student.${RUN_ID}@usth.edu.vn`;
const ADMIN_EMAIL = `availability.admin.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

const ROOM_A101_ID = '20000000-0000-4000-8000-000000000001';
const ROOM_A102_ID = '20000000-0000-4000-8000-000000000002';
const OPEN_DATE = '2099-01-05';
const CLOSED_DAY = '2099-01-04';
const CLOSURE_DATE = '2099-01-06';

describe('Resource availability (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let studentCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    const studentRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: STUDENT_EMAIL,
        password: PASSWORD,
        fullName: 'Availability Student',
      })
      .expect(201);
    studentCookie = findSetCookie(
      studentRegistration.headers,
      COOKIE_NAME,
    ) as string;

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ADMIN_EMAIL,
        password: PASSWORD,
        fullName: 'Availability Admin',
      })
      .expect(201);
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [
      ADMIN_EMAIL,
    ]);
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    adminCookie = findSetCookie(adminLogin.headers, COOKIE_NAME) as string;
  });

  afterAll(async () => {
    await deleteUsers(app, [STUDENT_EMAIL, ADMIN_EMAIL]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('requires authentication for availability', async () => {
    await api()
      .get(`/api/resources/${ROOM_A101_ID}/availability?date=${OPEN_DATE}`)
      .expect(401);
  });

  it('returns operating hours and hourly slots in campus time', async () => {
    const response = await api()
      .get(`/api/resources/${ROOM_A101_ID}/availability?date=${OPEN_DATE}`)
      .set('Cookie', studentCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      resourceId: ROOM_A101_ID,
      date: OPEN_DATE,
      timeZone: 'Asia/Ho_Chi_Minh',
      status: 'active',
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: '08:00',
      closesAt: '18:00',
      blockedReason: null,
      closureReason: null,
      requiresApproval: false,
    });
    expect(response.body.slots).toHaveLength(10);
    expect(response.body.slots[0]).toEqual({
      startTime: '08:00',
      endTime: '09:00',
    });
    expect(response.body.slots.at(-1)).toEqual({
      startTime: '17:00',
      endTime: '18:00',
    });
  });

  it('returns an explicit closed-day state', async () => {
    const response = await api()
      .get(`/api/resources/${ROOM_A101_ID}/availability?date=${CLOSED_DAY}`)
      .set('Cookie', studentCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      blockedReason: 'closed_day',
      slots: [],
    });
  });

  it('returns an explicit maintenance state for a hidden resource', async () => {
    const response = await api()
      .get(`/api/resources/${ROOM_A102_ID}/availability?date=${OPEN_DATE}`)
      .set('Cookie', studentCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      resourceId: ROOM_A102_ID,
      blockedReason: 'maintenance',
      slots: [],
    });
  });

  it('enforces the complete scoped closure lifecycle without shared fixtures', async () => {
    const createdResource = await api()
      .post('/api/admin/resources')
      .set('Cookie', adminCookie)
      .send({
        code: `AVAIL-${Date.now()}`,
        name: 'Availability E2E Resource',
        type: 'room',
        capacity: 4,
        location: 'Test location',
        buildingId: '10000000-0000-4000-8000-000000000001',
      })
      .expect(201);
    const resourceId = createdResource.body.id as string;

    try {
      await api()
        .post(`/api/admin/resources/${resourceId}/closures`)
        .set('Cookie', studentCookie)
        .send({ date: CLOSURE_DATE, reason: 'Scheduled review closure' })
        .expect(403);

      const created = await api()
        .post(`/api/admin/resources/${resourceId}/closures`)
        .set('Cookie', adminCookie)
        .send({ date: CLOSURE_DATE, reason: 'Scheduled review closure' })
        .expect(201);
      const closureId = created.body.id as string;

      expect(created.body).toMatchObject({
        resourceId,
        date: CLOSURE_DATE,
        reason: 'Scheduled review closure',
      });

      const list = await api()
        .get(`/api/admin/resources/${resourceId}/closures`)
        .set('Cookie', adminCookie)
        .expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({ id: closureId, date: CLOSURE_DATE }),
      ]);

      await api()
        .post(`/api/admin/resources/${resourceId}/closures`)
        .set('Cookie', adminCookie)
        .send({ date: CLOSURE_DATE, reason: 'Duplicate closure' })
        .expect(409);

      const availability = await api()
        .get(`/api/resources/${resourceId}/availability?date=${CLOSURE_DATE}`)
        .set('Cookie', studentCookie)
        .expect(200);
      expect(availability.body).toMatchObject({
        blockedReason: 'closure',
        closureReason: 'Scheduled review closure',
        slots: [],
      });

      const directory = await api()
        .get(
          `/api/resources?date=${CLOSURE_DATE}&startTime=09:00&endTime=11:00`,
        )
        .set('Cookie', studentCookie)
        .expect(200);
      expect(
        directory.body.items.some(
          (item: { id: string }) => item.id === resourceId,
        ),
      ).toBe(false);

      await api()
        .delete(`/api/admin/resources/${resourceId}/closures/${closureId}`)
        .set('Cookie', adminCookie)
        .expect(204);

      const reopened = await api()
        .get(`/api/resources/${resourceId}/availability?date=${CLOSURE_DATE}`)
        .set('Cookie', studentCookie)
        .expect(200);
      expect(reopened.body.blockedReason).toBeNull();
      expect(reopened.body.slots).toHaveLength(10);
    } finally {
      await dataSource.query('DELETE FROM resources WHERE id = $1', [
        resourceId,
      ]);
    }
  });

  it('filters directory results by operating day and interval', async () => {
    const open = await api()
      .get(`/api/resources?date=${OPEN_DATE}&startTime=09:00&endTime=11:00`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(open.body.total).toBe(3);

    const outsideHours = await api()
      .get(`/api/resources?date=${OPEN_DATE}&startTime=18:00&endTime=19:00`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(outsideHours.body.total).toBe(0);

    const closed = await api()
      .get(`/api/resources?date=${CLOSED_DAY}&startTime=09:00&endTime=11:00`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(closed.body.total).toBe(0);
  });

  it.each([
    `/api/resources/${ROOM_A101_ID}/availability?date=2026-02-30`,
    `/api/resources/${ROOM_A101_ID}/availability?date=not-a-date`,
    `/api/resources/${ROOM_A101_ID}/availability?date=${OPEN_DATE}&unknown=x`,
    `/api/resources?date=${OPEN_DATE}`,
    `/api/resources?date=${OPEN_DATE}&startTime=11:00&endTime=10:00`,
    `/api/resources?date=2026-02-30&startTime=09:00&endTime=10:00`,
    `/api/resources?q=room%00hidden`,
  ])('rejects invalid availability input %s', async (path) => {
    await api().get(path).set('Cookie', studentCookie).expect(400);
  });

  it('rejects null bytes in closure reasons as validation errors', async () => {
    await api()
      .post(`/api/admin/resources/${ROOM_A101_ID}/closures`)
      .set('Cookie', adminCookie)
      .send({ date: '2027-02-03', reason: 'ok\u0000hidden' })
      .expect(400);
  });

  it('returns 404 for an unknown resource', async () => {
    await api()
      .get(
        `/api/resources/99999999-9999-4999-8999-999999999999/availability?date=${OPEN_DATE}`,
      )
      .set('Cookie', studentCookie)
      .expect(404);
  });

  it('rejects a one-sided operating-hour update at the persisted boundary', async () => {
    await api()
      .patch(`/api/admin/resources/${ROOM_A101_ID}`)
      .set('Cookie', adminCookie)
      .send({ opensAt: '18:00' })
      .expect(400);

    const unchanged = await dataSource.query<
      { opens_at: string; closes_at: string }[]
    >(`SELECT opens_at::text, closes_at::text FROM resources WHERE id = $1`, [
      ROOM_A101_ID,
    ]);
    expect(unchanged[0]).toEqual({
      opens_at: '08:00:00',
      closes_at: '18:00:00',
    });
  });

  it('enforces operating-hour and closure constraints in PostgreSQL', async () => {
    await expect(
      dataSource.query(
        `UPDATE resources SET opens_at = '18:00', closes_at = '08:00' WHERE id = $1`,
        [ROOM_A101_ID],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      dataSource.query(
        `UPDATE resources SET opens_at = '08:30', closes_at = '18:00' WHERE id = $1`,
        [ROOM_A101_ID],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_resources_operating_hours_whole_hour',
    });

    await expect(
      dataSource.query(
        `UPDATE resources SET opens_at = '22:00', closes_at = '24:00' WHERE id = $1`,
        [ROOM_A101_ID],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_resources_operating_hours_supported_range',
    });

    await expect(
      dataSource.query(
        `UPDATE resources SET operating_days = ARRAY[1,1]::smallint[] WHERE id = $1`,
        [ROOM_A101_ID],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_resources_operating_days_unique',
    });

    await expect(
      dataSource.query(
        `UPDATE resources SET operating_days = ARRAY[8]::smallint[] WHERE id = $1`,
        [ROOM_A101_ID],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    for (const [date, reason] of [
      ['2027-02-04', ' '],
      ['2027-02-05', '\t'],
    ]) {
      await expect(
        dataSource.query(
          `INSERT INTO resource_closures (resource_id, date, reason) VALUES ($1, $2, $3)`,
          [ROOM_A101_ID, date, reason],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'CHK_resource_closures_reason_length',
      });
    }
  });
});
