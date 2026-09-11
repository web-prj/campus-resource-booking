import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfig, AuthConfig } from './config';
import { setupSwagger } from './swagger';

export interface AppSetupOptions {
  enableShutdownHooks?: boolean;
  enableSwagger?: boolean;
}

/** Shared HTTP pipeline for production bootstrap and e2e tests. */
export function configureApp(
  app: NestExpressApplication,
  appConfig: AppConfig,
  authConfig: AuthConfig,
  options: AppSetupOptions = {},
): void {
  app.setGlobalPrefix(appConfig.apiPrefix);
  app.use(cookieParser());
  app.use(helmet());

  if (appConfig.isProduction) {
    app.set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({ origin: appConfig.corsOrigins, credentials: true });

  if (options.enableSwagger) {
    setupSwagger(app, appConfig.apiPrefix, authConfig.cookie.name);
  }

  if (options.enableShutdownHooks) {
    app.enableShutdownHooks();
  }
}
