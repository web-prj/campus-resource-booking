import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig, appConfig, AuthConfig, authConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const applicationConfig = app.get<AppConfig>(appConfig.KEY);
  const authenticationConfig = app.get<AuthConfig>(authConfig.KEY);

  configureApp(app, applicationConfig, authenticationConfig, {
    enableShutdownHooks: true,
    enableSwagger: !applicationConfig.isProduction,
  });

  await app.listen(applicationConfig.port);
}

void bootstrap();
