import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createSwaggerConfig(cookieName = 'access_token') {
  return new DocumentBuilder()
    .setTitle('Campus Resource Booking API')
    .setDescription(
      'Room and equipment reservations. Authentication uses an httpOnly session cookie: ' +
        'call POST /auth/login, then send subsequent requests with credentials included.',
    )
    .setVersion('1.0')
    .addCookieAuth(cookieName)
    .build();
}

/**
 * Interactive docs at `/{prefix}/docs`. Registered outside production so the
 * schema is not published publicly.
 */
export function setupSwagger(
  app: INestApplication,
  apiPrefix: string,
  cookieName: string,
): void {
  const config = createSwaggerConfig(cookieName);

  SwaggerModule.setup(
    `${apiPrefix}/docs`,
    app,
    SwaggerModule.createDocument(app, config),
    { swaggerOptions: { withCredentials: true } },
  );
}
