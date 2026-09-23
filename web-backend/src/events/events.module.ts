import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfig, appConfig, authConfig } from '../config';
import { UsersModule } from '../users/users.module';
import { AvailabilityEventsService } from './availability-events.service';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    UsersModule,
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(authConfig),
    JwtModule.registerAsync({
      ...authConfig.asProvider(),
      useFactory: (config: AuthConfig) => ({
        secret: config.jwt.secret,
        signOptions: { expiresIn: config.jwt.expiresIn },
      }),
    }),
  ],
  providers: [EventsGateway, AvailabilityEventsService],
  exports: [AvailabilityEventsService],
})
export class EventsModule {}
