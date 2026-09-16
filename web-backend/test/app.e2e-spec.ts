import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { createSwaggerConfig } from '../src/swagger';

const CORS_ORIGIN =
  process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:18321';

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

  it('documents every MVP API area with cookie authentication', () => {
    const document = SwaggerModule.createDocument(app, createSwaggerConfig());
    const operations = Object.values(document.paths).flatMap((path) =>
      Object.values(path ?? {}).filter(
        (operation): operation is { operationId: string; tags?: string[] } =>
          typeof operation === 'object' &&
          operation !== null &&
          'operationId' in operation,
      ),
    );
    const tags = new Set(
      operations.flatMap((operation) => operation.tags ?? []),
    );
    for (const tag of [
      'auth',
      'resources',
      'admin resources',
      'bookings',
      'staff bookings',
      'admin users',
      'admin analytics',
      'health',
    ]) {
      expect(tags).toContain(tag);
    }
    expect(document.components?.securitySchemes?.cookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    });
    const operationIds = operations.map((operation) => operation.operationId);
    expect(operationIds.length).toBeGreaterThanOrEqual(20);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('requires authentication on routes that are not marked public', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
