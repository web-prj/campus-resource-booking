import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';

const CORS_ORIGIN =
  process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:46121';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes the health check without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows credentialed CORS from the companion frontend', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(CORS_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('requires authentication on routes that are not marked public', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
