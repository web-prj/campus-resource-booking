import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, deleteUsers, findSetCookie } from './utils/test-app';

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STUDENT_EMAIL = `discovery.student.${RUN_ID}@usth.edu.vn`;
const PASSWORD = 'password123';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'access_token';

const ROOM_A101_ID = '20000000-0000-4000-8000-000000000001';
const ROOM_A102_ID = '20000000-0000-4000-8000-000000000002';
const LAB_L201_ID = '20000000-0000-4000-8000-000000000003';
const EQUIPMENT_ID = '20000000-0000-4000-8000-000000000004';
const MAIN_BUILDING_ID = '10000000-0000-4000-8000-000000000001';
const LAB_BUILDING_ID = '10000000-0000-4000-8000-000000000002';

describe('Resource discovery (e2e)', () => {
  let app: INestApplication;
  let studentCookie: string;

  beforeAll(async () => {
    app = await createTestApp();

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: STUDENT_EMAIL,
        password: PASSWORD,
        fullName: 'Discovery Student',
      })
      .expect(201);

    studentCookie = findSetCookie(registration.headers, COOKIE_NAME) as string;
  });

  afterAll(async () => {
    await deleteUsers(app, [STUDENT_EMAIL]);
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('requires authentication for directory, buildings, and details', async () => {
    await api().get('/api/resources').expect(401);
    await api().get('/api/resources/buildings').expect(401);
    await api().get(`/api/resources/${ROOM_A101_ID}`).expect(401);
  });

  it('lists only active resources with deterministic page metadata', async () => {
    const response = await api()
      .get('/api/resources')
      .set('Cookie', studentCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 9,
      totalPages: 1,
    });
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      EQUIPMENT_ID,
      ROOM_A101_ID,
      LAB_L201_ID,
    ]);
    expect(
      response.body.items.some(
        (item: { id: string }) => item.id === ROOM_A102_ID,
      ),
    ).toBe(false);
  });

  it('searches resource identity, location, and building fields literally', async () => {
    const byName = await api()
      .get('/api/resources?q=projector')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(byName.body.items.map((item: { id: string }) => item.id)).toEqual([
      EQUIPMENT_ID,
    ]);

    const byCode = await api()
      .get('/api/resources?q=ROOM-A101')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(byCode.body.items.map((item: { id: string }) => item.id)).toEqual([
      ROOM_A101_ID,
    ]);

    const byLocation = await api()
      .get('/api/resources?q=first%20floor')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(
      byLocation.body.items.map((item: { id: string }) => item.id),
    ).toEqual([ROOM_A101_ID]);

    const byBuilding = await api()
      .get('/api/resources?q=laboratory%20building')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(
      byBuilding.body.items.map((item: { id: string }) => item.id),
    ).toEqual([LAB_L201_ID]);

    const literalWildcard = await api()
      .get('/api/resources?q=%25')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(literalWildcard.body.items).toEqual([]);
  });

  it('filters by building, type, capacity, and normalized amenity', async () => {
    const building = await api()
      .get(`/api/resources?buildingId=${MAIN_BUILDING_ID}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(building.body.total).toBe(2);
    expect(
      building.body.items.every(
        (item: { building: { id: string } }) =>
          item.building.id === MAIN_BUILDING_ID,
      ),
    ).toBe(true);

    const type = await api()
      .get('/api/resources?type=laboratory')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(type.body.items.map((item: { id: string }) => item.id)).toEqual([
      LAB_L201_ID,
    ]);

    const capacity = await api()
      .get('/api/resources?minCapacity=20')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(capacity.body.items.map((item: { id: string }) => item.id)).toEqual([
      LAB_L201_ID,
    ]);

    const amenity = await api()
      .get('/api/resources?amenity=DISPLAY')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(amenity.body.items.map((item: { id: string }) => item.id)).toEqual([
      ROOM_A101_ID,
    ]);
    const combined = await api()
      .get(
        `/api/resources?buildingId=${MAIN_BUILDING_ID}&type=room&minCapacity=8&amenity=DISPLAY`,
      )
      .set('Cookie', studentCookie)
      .expect(200);
    expect(combined.body.items.map((item: { id: string }) => item.id)).toEqual([
      ROOM_A101_ID,
    ]);
  });

  it('sorts and paginates with stable metadata', async () => {
    const sorted = await api()
      .get('/api/resources?sort=capacity_desc')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(
      sorted.body.items.map((item: { capacity: number }) => item.capacity),
    ).toEqual([24, 8, 1]);

    const page = await api()
      .get('/api/resources?sort=capacity_desc&page=2&pageSize=1')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(page.body).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 1,
      totalPages: 3,
    });
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0].id).toBe(ROOM_A101_ID);

    const beyondLastPage = await api()
      .get('/api/resources?page=99&pageSize=1')
      .set('Cookie', studentCookie)
      .expect(200);
    expect(beyondLastPage.body).toMatchObject({
      items: [],
      total: 3,
      page: 99,
      pageSize: 1,
      totalPages: 3,
    });
  });

  it('lists buildings used by discovery filters', async () => {
    const response = await api()
      .get('/api/resources/buildings')
      .set('Cookie', studentCookie)
      .expect(200);

    expect(
      response.body.map((building: { id: string }) => building.id),
    ).toEqual([LAB_BUILDING_ID, MAIN_BUILDING_ID]);
  });

  it('returns active resource details and hides unavailable resources', async () => {
    const active = await api()
      .get(`/api/resources/${ROOM_A101_ID}`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(active.body).toMatchObject({
      id: ROOM_A101_ID,
      status: 'active',
      building: { id: MAIN_BUILDING_ID },
    });

    await api()
      .get(`/api/resources/${ROOM_A102_ID}`)
      .set('Cookie', studentCookie)
      .expect(404);
  });

  it.each([
    '/api/resources?page=0',
    '/api/resources?pageSize=25',
    '/api/resources?minCapacity=0',
    '/api/resources?type=vehicle',
    '/api/resources?sort=newest',
    '/api/resources?unknown=value',
  ])('rejects invalid discovery query %s', async (path) => {
    await api().get(path).set('Cookie', studentCookie).expect(400);
  });
});
