import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

jest.setTimeout(15_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_EMAIL = `analytics.admin.${RUN_ID}@usth.edu.vn`;
const STUDENT_EMAIL = `analytics.student.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';
const BUILDING_ID = '10000000-0000-4000-8000-000000000001';
const FROM = '2099-03-02';
const TO = '2099-03-04';

describe('Admin booking analytics (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminCookie: string;
  let studentCookie: string;
  let studentId: string;
  let maintenanceResourceId: string;
  const resourceIds: string[] = [];

  const api = () => request(app.getHttpServer());

  async function register(email: string, fullName: string): Promise<string> {
    const response = await api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, fullName })
      .expect(201);
    return response.body.id as string;
  }

  async function login(email: string): Promise<string> {
    const response = await api()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return findSetCookie(response.headers, COOKIE_NAME) as string;
  }

  async function resource(
    name: string,
    hours: [string, string],
    status: 'active' | 'maintenance' = 'active',
  ): Promise<string> {
    const [row] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO resources (
        code, name, type, status, capacity, location, requires_approval,
        operating_days, opens_at, closes_at, building_id
      ) VALUES ($1, $2, 'room', $5, 8, 'Analytics location', false,
        ARRAY[1,2,3]::smallint[], $3, $4, $6) RETURNING id`,
      [
        `AN-${RUN_ID.slice(-8)}-${resourceIds.length + 1}`,
        name,
        ...hours,
        status,
        BUILDING_ID,
      ],
    );
    resourceIds.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await register(ADMIN_EMAIL, 'Analytics Admin');
    studentId = await register(STUDENT_EMAIL, 'Analytics Student');
    await dataSource.query(
      `UPDATE users SET role = 'admin'::users_role_enum WHERE email = $1`,
      [ADMIN_EMAIL],
    );
    adminCookie = await login(ADMIN_EMAIL);
    studentCookie = await login(STUDENT_EMAIL);

    const first = await resource('Analytics Room One', ['08:00', '12:00']);
    const second = await resource('Analytics Room Two', ['09:00', '13:00']);
    maintenanceResourceId = await resource(
      'Analytics Maintenance Room',
      ['08:00', '18:00'],
      'maintenance',
    );
    await dataSource.query(
      `UPDATE resources SET created_at = '2099-03-01T00:00:00Z'
       WHERE id = ANY($1)`,
      [resourceIds],
    );
    await dataSource.query(
      `INSERT INTO resource_closures (resource_id, date, reason)
       VALUES ($1, '2099-03-03', 'Analytics closure')`,
      [second],
    );
    await dataSource.query(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        cancelled_at, reviewed_at, reviewed_by_id, rejection_reason,
        check_in_code, check_in_requested_at, checked_in_at, checked_in_by_id,
        checked_out_at, checked_out_by_id, no_show_at, no_show_by_id
      ) VALUES
        ($1, $3, '2099-03-02', '08:00', '10:00', 'completed', NULL, now(), $3, NULL, NULL, '2099-03-02T07:50:00+07:00', '2099-03-02T08:00:00+07:00', $3, '2099-03-02T10:00:00+07:00', $3, NULL, NULL),
        ($1, $3, '2099-03-03', '09:00', '11:00', 'confirmed', NULL, now(), $3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
        ($1, $3, '2099-03-04', '10:00', '11:00', 'cancelled', now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
        ($2, $3, '2099-03-02', '09:00', '12:00', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
        ($2, $3, '2099-03-03', '10:00', '11:00', 'rejected', NULL, now(), $3, 'Not available', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
        ($2, $3, '2099-03-04', '11:00', '12:00', 'no_show', NULL, now(), $3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2099-03-04T12:00:00+07:00', $3),
        ($4, $3, '2099-03-02', '08:00', '12:00', 'confirmed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
      [first, second, studentId, maintenanceResourceId],
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
    await deleteUsers(app, [ADMIN_EMAIL, STUDENT_EMAIL]);
    await app.close();
  });

  it('requires an authenticated administrator', async () => {
    await api()
      .get('/api/admin/analytics')
      .query({ from: FROM, to: TO })
      .expect(401);
    await api()
      .get('/api/admin/analytics')
      .query({ from: FROM, to: TO })
      .set('Cookie', studentCookie)
      .expect(403);
  });

  it('validates date ranges strictly', async () => {
    for (const query of [
      { from: 'not-a-date', to: TO },
      { from: '2099-02-30', to: TO },
      { from: TO, to: FROM },
      { from: '2098-01-01', to: '2099-03-04' },
      { from: FROM, to: TO, extra: 'no' },
    ]) {
      await api()
        .get('/api/admin/analytics')
        .query(query)
        .set('Cookie', adminCookie)
        .expect(400);
    }
  });

  it('returns authoritative counts, rankings, peak hours, and utilization', async () => {
    const response = await api()
      .get('/api/admin/analytics')
      .query({ from: FROM, to: TO })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      from: FROM,
      to: TO,
      timeZone: 'Asia/Ho_Chi_Minh',
      totalBookings: 7,
      cancelledBookings: 1,
      cancellationRate: 14.3,
      scheduledHours: 7,
      resourcesRepresented: 3,
      statuses: expect.arrayContaining([
        { status: 'confirmed', count: 2, percentage: 28.6 },
        { status: 'pending', count: 1, percentage: 14.3 },
        { status: 'completed', count: 1, percentage: 14.3 },
        { status: 'no_show', count: 1, percentage: 14.3 },
        { status: 'rejected', count: 1, percentage: 14.3 },
        { status: 'cancelled', count: 1, percentage: 14.3 },
      ]),
      popularResources: [
        expect.objectContaining({
          name: 'Analytics Room One',
          bookingCount: 2,
          bookedHours: 4,
        }),
        expect.objectContaining({
          name: 'Analytics Room Two',
          bookingCount: 2,
          bookedHours: 4,
        }),
        expect.objectContaining({
          name: 'Analytics Maintenance Room',
          bookingCount: 1,
          bookedHours: 4,
        }),
      ],
      peakHours: [
        { hour: 8, label: '08:00', bookingCount: 2 },
        { hour: 9, label: '09:00', bookingCount: 4 },
        { hour: 10, label: '10:00', bookingCount: 3 },
        { hour: 11, label: '11:00', bookingCount: 3 },
      ],
    });
    expect(
      response.body.popularResources.map((item: { name: string }) => item.name),
    ).toEqual([
      'Analytics Room One',
      'Analytics Room Two',
      'Analytics Maintenance Room',
    ]);
    expect(response.body.capacityHours).toBeGreaterThan(0);
    expect(response.body.scheduledHours).toBe(7);
    expect(response.body.utilizationRate).toBe(
      Math.round((7 / response.body.capacityHours) * 1000) / 10,
    );
    await dataSource.query(
      `UPDATE resources SET status = 'active'::resources_status_enum WHERE id = $1`,
      [maintenanceResourceId],
    );
    try {
      const withMaintenance = await api()
        .get('/api/admin/analytics')
        .query({ from: FROM, to: TO })
        .set('Cookie', adminCookie)
        .expect(200);
      expect(withMaintenance.body.capacityHours).toBe(
        response.body.capacityHours + 30,
      );
      expect(withMaintenance.body.scheduledHours).toBe(11);
      expect(withMaintenance.body.utilizationRate).toBe(
        Math.round((11 / withMaintenance.body.capacityHours) * 1000) / 10,
      );
    } finally {
      await dataSource.query(
        `UPDATE resources SET status = 'maintenance'::resources_status_enum WHERE id = $1`,
        [maintenanceResourceId],
      );
    }
    expect(response.body.definition).toContain('no-show requests');
  });

  it('returns a complete zero-data shape', async () => {
    const response = await api()
      .get('/api/admin/analytics')
      .query({ from: '2020-03-02', to: '2020-03-04' })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body.totalBookings).toBe(0);
    expect(response.body.cancellationRate).toBe(0);
    expect(response.body.scheduledHours).toBe(0);
    expect(response.body.capacityHours).toBe(0);
    expect(response.body.utilizationRate).toBeNull();
    expect(response.body.popularResources).toEqual([]);
    expect(response.body.peakHours).toEqual([]);
    expect(response.body.statuses).toHaveLength(7);
    expect(
      response.body.statuses.every(
        (entry: { count: number }) => entry.count === 0,
      ),
    ).toBe(true);
  });
});
