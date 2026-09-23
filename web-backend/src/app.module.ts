import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BookingsModule } from './bookings/bookings.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { configurations, envValidationSchema } from './config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ResourcesModule } from './resources/resources.module';
import { ThrottlerConfigModule } from './throttler/throttler.module';
import { UsersModule } from './users/users.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true, ttl: 300000 }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Real environment variables take precedence over these files, so a
      // deployed container ignores them entirely.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: configurations,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    DatabaseModule,
    ThrottlerConfigModule,
    HealthModule,
    UsersModule,
    ResourcesModule,
    BookingsModule,
    AnalyticsModule,
    AuthModule,
    EventsModule,
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
