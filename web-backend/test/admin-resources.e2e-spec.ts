import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ADMIN_EMAIL = `resource.admin.${RUN_ID}@usth.edu.vn`;
const STUDENT_EMAIL = `resource.student.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const RESOURCE_CODE = `ROOM-TEST-${Date.now()}`;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

describe('Admin resource management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminCookie: string;
  let studentCookie: string;
  let buildingId: string;
  let resourceId: string | undefined;
  let conflictResourceId: string | undefined;
  let studentId: string;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    const studentRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: STUDENT_EMAIL,
        password: PASSWORD,
        fullName: 'Resource Student',
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
        fullName: 'Resource Admin',
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

    const [building] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM buildings WHERE code = 'MAIN'`,
    );
    buildingId = building.id;

    const ids = await dataSource.query<{ id: string; email: string }[]>(
      'SELECT id, email FROM users WHERE email = ANY($1)',
      [[ADMIN_EMAIL, STUDENT_EMAIL]],
    );
    adminId = ids.find(({ email }) => email === ADMIN_EMAIL)?.id as string;
    studentId = ids.find(({ email }) => email === STUDENT_EMAIL)?.id as string;
  });

  afterAll(async () => {
    if (conflictResourceId) {
      await dataSource.query('DELETE FROM bookings WHERE resource_id = $1', [
        conflictResourceId,
      ]);
      await dataSource.query('DELETE FROM resources WHERE id = $1', [
        conflictResourceId,
      ]);
    }
    if (resourceId) {
      await dataSource.query('DELETE FROM resources WHERE id = $1', [
        resourceId,
      ]);
    }
    await deleteUsers(app, [ADMIN_EMAIL, STUDENT_EMAIL]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('requires authentication and the administrator role', async () => {
    await api().get('/api/admin/resources').expect(401);
    await api()
      .get('/api/admin/resources')
      .set('Cookie', studentCookie)
      .expect(403);
  });

  it('lists buildings for the resource form', async () => {
    const response = await api()
      .get('/api/admin/resources/buildings')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: buildingId,
          code: 'MAIN',
          name: 'Main Academic Building',
        }),
      ]),
    );
  });

  it('rejects unknown fields and invalid resource data', async () => {
    await api()
      .post('/api/admin/resources')
      .set('Cookie', adminCookie)
      .send({
        code: RESOURCE_CODE,
        name: 'Test room',
        type: 'room',
        capacity: 0,
        location: 'Test floor',
        buildingId,
        status: 'inactive',
      })
      .expect(400);
  });

  it('returns 404 for an unknown building', async () => {
    await api()
      .post('/api/admin/resources')
      .set('Cookie', adminCookie)
      .send({
        code: RESOURCE_CODE,
        name: 'Test room',
        type: 'room',
        capacity: 8,
        location: 'Test floor',
        buildingId: '99999999-9999-4999-8999-999999999999',
      })
      .expect(404);
  });

  it('creates and returns a normalized resource', async () => {
    const response = await api()
      .post('/api/admin/resources')
      .set('Cookie', adminCookie)
      .send({
        code: RESOURCE_CODE.toLowerCase(),
        name: '  Collaboration Room  ',
        description: '  Near the student services desk.  ',
        type: 'room',
        capacity: 10,
        location: '  Ground floor  ',
        amenities: [' Whiteboard ', 'DISPLAY'],
        requiresApproval: true,
        buildingId,
      })
      .expect(201);

    resourceId = response.body.id as string;
    expect(response.body).toMatchObject({
      code: RESOURCE_CODE,
      name: 'Collaboration Room',
      description: 'Near the student services desk.',
      type: 'room',
      status: 'active',
      capacity: 10,
      location: 'Ground floor',
      amenities: ['whiteboard', 'display'],
      requiresApproval: true,
      building: { id: buildingId, code: 'MAIN' },
    });
  });

  it('rejects a duplicate resource code with 409', async () => {
    await api()
      .post('/api/admin/resources')
      .set('Cookie', adminCookie)
      .send({
        code: RESOURCE_CODE.toLowerCase(),
        name: 'Duplicate room',
        type: 'room',
        capacity: 4,
        location: 'Ground floor',
        buildingId,
      })
      .expect(409);
  });

  it('lists the newly created resource across paginated results', async () => {
    const first = await api()
      .get('/api/admin/resources')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(first.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    const { total } = first.body as { total: number };
    expect(first.body.totalPages).toBe(Math.ceil(total / 20));

    const pageSize = 50;
    const listed: { id: string; code: string; name: string }[] = [];
    for (let page = 1; page <= Math.ceil(total / pageSize); page++) {
      const response = await api()
        .get(`/api/admin/resources?page=${page}&pageSize=${pageSize}`)
        .set('Cookie', adminCookie)
        .expect(200);
      expect(response.body).toMatchObject({ total, page, pageSize });
      listed.push(...response.body.items);
    }
    expect(listed).toHaveLength(total);
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: resourceId, code: RESOURCE_CODE }),
      ]),
    );
    const firstTwoNames = listed.slice(0, 2).map(({ name }) => name);
    expect([...firstTwoNames].sort()).toEqual(firstTwoNames);

    for (const query of ['page=0', 'pageSize=0', 'pageSize=51']) {
      await api()
        .get(`/api/admin/resources?${query}`)
        .set('Cookie', adminCookie)
        .expect(400);
    }
  });

  it('edits resource details without accepting status changes', async () => {
    await api()
      .patch(`/api/admin/resources/${resourceId}`)
      .set('Cookie', adminCookie)
      .send({ status: 'maintenance' })
      .expect(400);

    const response = await api()
      .patch(`/api/admin/resources/${resourceId}`)
      .set('Cookie', adminCookie)
      .send({
        name: 'Updated Collaboration Room',
        capacity: 12,
        amenities: ['whiteboard'],
        requiresApproval: false,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: resourceId,
      name: 'Updated Collaboration Room',
      capacity: 12,
      amenities: ['whiteboard'],
      requiresApproval: false,
      status: 'active',
    });
  });

  it('clears an optional description', async () => {
    const response = await api()
      .patch(`/api/admin/resources/${resourceId}`)
      .set('Cookie', adminCookie)
      .send({ description: '' })
      .expect(200);

    expect(response.body.description).toBeNull();
  });

  it('preserves concurrent detail and status changes', async () => {
    const [detailsResponse, statusResponse] = await Promise.all([
      api()
        .patch(`/api/admin/resources/${resourceId}`)
        .set('Cookie', adminCookie)
        .send({ name: 'Concurrent Collaboration Room', capacity: 14 }),
      api()
        .patch(`/api/admin/resources/${resourceId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'maintenance' }),
    ]);

    expect(detailsResponse.status).toBe(200);
    expect(statusResponse.status).toBe(200);

    const [stored] = await dataSource.query<
      { name: string; capacity: number; status: string }[]
    >(`SELECT name, capacity, status FROM resources WHERE id = $1`, [
      resourceId,
    ]);
    expect(stored).toEqual({
      name: 'Concurrent Collaboration Room',
      capacity: 14,
      status: 'maintenance',
    });
  });

  it('changes operational status through the explicit endpoint', async () => {
    for (const status of ['maintenance', 'inactive', 'active']) {
      const response = await api()
        .patch(`/api/admin/resources/${resourceId}/status`)
        .set('Cookie', adminCookie)
        .send({ status })
        .expect(200);

      expect(response.body).toMatchObject({ id: resourceId, status });
    }
  });

  it('returns 404 for an unknown resource', async () => {
    await api()
      .patch('/api/admin/resources/99999999-9999-4999-8999-999999999999/status')
      .set('Cookie', adminCookie)
      .send({ status: 'inactive' })
      .expect(404);
  });

  describe('changes that conflict with active bookings', () => {
    type Status =
      'pending' | 'confirmed' | 'checked_in' | 'cancelled' | 'rejected';

    async function insertBooking(
      date: string,
      startTime: string,
      endTime: string,
      status: Status,
    ): Promise<string> {
      const base = [conflictResourceId, studentId, date, startTime, endTime];
      const queries: Record<Status, [string, unknown[]]> = {
        pending: [
          `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
          base,
        ],
        confirmed: [
          `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING id`,
          base,
        ],
        cancelled: [
          `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status, cancelled_at)
           VALUES ($1, $2, $3, $4, $5, 'cancelled', NOW()) RETURNING id`,
          base,
        ],
        rejected: [
          `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status,
             reviewed_at, reviewed_by_id, rejection_reason)
           VALUES ($1, $2, $3, $4, $5, 'rejected', NOW(), $6, 'Not available') RETURNING id`,
          [...base, adminId],
        ],
        checked_in: [
          `INSERT INTO bookings (resource_id, requester_id, booking_date, start_time, end_time, status,
             check_in_requested_at, checked_in_at, checked_in_by_id)
           VALUES ($1, $2, $3, $4, $5, 'checked_in',
             ($3::date + $4::time) AT TIME ZONE 'Asia/Ho_Chi_Minh',
             ($3::date + $4::time) AT TIME ZONE 'Asia/Ho_Chi_Minh', $6)
           RETURNING id`,
          [...base, adminId],
        ],
      };
      const [sql, parameters] = queries[status];
      const [row] = await dataSource.query<{ id: string }[]>(sql, parameters);
      return row.id;
    }

    async function clearBookings(): Promise<void> {
      await dataSource.query('DELETE FROM bookings WHERE resource_id = $1', [
        conflictResourceId,
      ]);
    }

    async function storedResource() {
      const [row] = await dataSource.query<
        {
          status: string;
          operating_days: number[];
          opens_at: string;
          closes_at: string;
        }[]
      >(
        'SELECT status, operating_days, opens_at, closes_at FROM resources WHERE id = $1',
        [conflictResourceId],
      );
      return row;
    }

    const setStatus = (status: string) =>
      api()
        .patch(`/api/admin/resources/${conflictResourceId}/status`)
        .set('Cookie', adminCookie)
        .send({ status });

    const addClosure = (date: string) =>
      api()
        .post(`/api/admin/resources/${conflictResourceId}/closures`)
        .set('Cookie', adminCookie)
        .send({ date, reason: 'Conflict test closure' });

    const editSchedule = (changes: Record<string, unknown>) =>
      api()
        .patch(`/api/admin/resources/${conflictResourceId}`)
        .set('Cookie', adminCookie)
        .send(changes);

    beforeAll(async () => {
      const [row] = await dataSource.query<{ id: string }[]>(
        `INSERT INTO resources (
          code, name, type, status, capacity, location, requires_approval,
          operating_days, opens_at, closes_at, building_id
        ) VALUES ($1, 'Conflict Room', 'room', 'active', 8, 'Conflict floor', false,
          ARRAY[1,2,3,4,5,6]::smallint[], '08:00', '18:00', $2)
        RETURNING id`,
        [`CF-${Date.now().toString(36).slice(-7)}`, buildingId],
      );
      conflictResourceId = row.id;
    });

    afterEach(clearBookings);

    it('allows status changes when only inactive or ended bookings exist', async () => {
      await insertBooking('2099-02-02', '09:00', '10:00', 'cancelled');
      await insertBooking('2099-02-02', '10:00', '11:00', 'rejected');
      await insertBooking('2020-01-06', '09:00', '10:00', 'confirmed');
      await insertBooking('2020-01-07', '09:00', '10:00', 'pending');

      for (const status of ['maintenance', 'inactive', 'active']) {
        await setStatus(status).expect(200);
      }
    });

    it('blocks maintenance and inactive status while bookings are active', async () => {
      const confirmedId = await insertBooking(
        '2099-02-05',
        '10:00',
        '11:00',
        'confirmed',
      );
      const pendingId = await insertBooking(
        '2099-02-04',
        '09:00',
        '10:00',
        'pending',
      );

      for (const status of ['maintenance', 'inactive']) {
        const response = await setStatus(status).expect(409);
        expect(response.body).toEqual({
          code: 'RESOURCE_HAS_ACTIVE_BOOKINGS',
          message: `Resolve 2 active bookings before setting this resource to ${status}.`,
          conflictCount: 2,
          conflictingBookings: [
            {
              id: pendingId,
              date: '2099-02-04',
              startTime: '09:00',
              endTime: '10:00',
              status: 'pending',
            },
            {
              id: confirmedId,
              date: '2099-02-05',
              startTime: '10:00',
              endTime: '11:00',
              status: 'confirmed',
            },
          ],
        });
      }
      expect((await storedResource()).status).toBe('active');
    });

    it('treats a checked-in booking as active even after its scheduled end', async () => {
      const checkedInId = await insertBooking(
        '2020-01-08',
        '09:00',
        '10:00',
        'checked_in',
      );

      const response = await setStatus('maintenance').expect(409);
      expect(response.body).toMatchObject({
        conflictCount: 1,
        conflictingBookings: [{ id: checkedInId, status: 'checked_in' }],
      });
    });

    it('never blocks returning a resource to active', async () => {
      await setStatus('maintenance').expect(200);
      await insertBooking('2099-02-04', '09:00', '10:00', 'confirmed');

      await setStatus('active').expect(200);
      expect((await storedResource()).status).toBe('active');
    });

    it('blocks a closure only on a date with active bookings', async () => {
      await insertBooking('2099-02-09', '09:00', '10:00', 'cancelled');
      await insertBooking('2099-02-09', '10:00', '11:00', 'rejected');
      await insertBooking('2099-02-02', '09:00', '10:00', 'confirmed');
      const allowed = await addClosure('2099-02-09').expect(201);
      await api()
        .delete(
          `/api/admin/resources/${conflictResourceId}/closures/${allowed.body.id}`,
        )
        .set('Cookie', adminCookie)
        .expect(204);

      const checkedInId = await insertBooking(
        '2099-02-10',
        '11:00',
        '12:00',
        'checked_in',
      );
      const pendingId = await insertBooking(
        '2099-02-10',
        '08:00',
        '09:00',
        'pending',
      );
      const response = await addClosure('2099-02-10').expect(409);
      expect(response.body).toEqual({
        code: 'RESOURCE_HAS_ACTIVE_BOOKINGS',
        message:
          'Resolve 2 active bookings before closing this resource on 2099-02-10.',
        conflictCount: 2,
        conflictingBookings: [
          {
            id: pendingId,
            date: '2099-02-10',
            startTime: '08:00',
            endTime: '09:00',
            status: 'pending',
          },
          {
            id: checkedInId,
            date: '2099-02-10',
            startTime: '11:00',
            endTime: '12:00',
            status: 'checked_in',
          },
        ],
      });
      const [{ count }] = await dataSource.query<{ count: string }[]>(
        'SELECT count(*)::text AS count FROM resource_closures WHERE resource_id = $1',
        [conflictResourceId],
      );
      expect(count).toBe('0');
    });

    it('allows a closure on a date whose bookings have already ended', async () => {
      await insertBooking('2020-01-06', '09:00', '10:00', 'confirmed');
      await insertBooking('2020-01-06', '10:00', '11:00', 'pending');

      const closure = await addClosure('2020-01-06').expect(201);
      await api()
        .delete(
          `/api/admin/resources/${conflictResourceId}/closures/${closure.body.id}`,
        )
        .set('Cookie', adminCookie)
        .expect(204);
    });

    it('lists at most ten conflicts but reports the full count', async () => {
      for (let hour = 8; hour < 20; hour++) {
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        await insertBooking('2099-02-11', start, end, 'confirmed');
      }

      const response = await addClosure('2099-02-11').expect(409);
      expect(response.body.conflictCount).toBe(12);
      expect(response.body.message).toBe(
        'Resolve 12 active bookings before closing this resource on 2099-02-11.',
      );
      expect(
        response.body.conflictingBookings.map(
          ({ startTime }: { startTime: string }) => startTime,
        ),
      ).toEqual([
        '08:00',
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
      ]);
    });

    it('blocks schedule changes that would exclude active bookings', async () => {
      const saturdayId = await insertBooking(
        '2099-02-14',
        '09:00',
        '10:00',
        'confirmed',
      );
      const earlyId = await insertBooking(
        '2099-02-16',
        '08:00',
        '09:00',
        'pending',
      );
      const lateId = await insertBooking(
        '2099-02-17',
        '17:00',
        '18:00',
        'confirmed',
      );
      await insertBooking('2099-02-21', '09:00', '10:00', 'cancelled');
      await insertBooking('2020-01-04', '09:00', '10:00', 'confirmed');

      const cases: Array<[Record<string, unknown>, string]> = [
        [{ operatingDays: [1, 2, 3, 4, 5] }, saturdayId],
        [{ opensAt: '09:00' }, earlyId],
        [{ closesAt: '17:00' }, lateId],
      ];
      for (const [changes, conflictId] of cases) {
        const response = await editSchedule(changes).expect(409);
        expect(response.body).toEqual({
          code: 'RESOURCE_HAS_ACTIVE_BOOKINGS',
          message:
            'Resolve 1 active booking outside the new operating schedule before saving it.',
          conflictCount: 1,
          conflictingBookings: [expect.objectContaining({ id: conflictId })],
        });
      }
      expect(await storedResource()).toMatchObject({
        operating_days: [1, 2, 3, 4, 5, 6],
        opens_at: '08:00:00',
        closes_at: '18:00:00',
      });

      const combined = await editSchedule({
        operatingDays: [1, 2, 3, 4, 5],
        opensAt: '09:00',
        closesAt: '17:00',
      }).expect(409);
      expect(combined.body.conflictCount).toBe(3);
    });

    it('allows schedule changes that keep every active booking', async () => {
      await insertBooking('2099-02-14', '09:00', '10:00', 'confirmed');
      await insertBooking('2099-02-16', '10:00', '11:00', 'pending');
      await insertBooking('2099-02-21', '08:00', '09:00', 'cancelled');
      await insertBooking('2099-02-17', '08:00', '09:00', 'rejected');

      await editSchedule({ name: 'Renamed Conflict Room' }).expect(200);
      await editSchedule({ operatingDays: [6, 5, 4, 3, 2, 1] }).expect(200);
      await editSchedule({ operatingDays: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
      const narrowed = await editSchedule({
        operatingDays: [1, 6],
        opensAt: '09:00',
        closesAt: '11:00',
      }).expect(200);
      expect(narrowed.body).toMatchObject({
        operatingDays: [1, 6],
        opensAt: '09:00',
        closesAt: '11:00',
      });
    });
  });
});
