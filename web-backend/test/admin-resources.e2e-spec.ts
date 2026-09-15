import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
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
  });

  afterAll(async () => {
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

  it('lists the newly created resource', async () => {
    const response = await api()
      .get('/api/admin/resources')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: resourceId, code: RESOURCE_CODE }),
      ]),
    );
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
});
