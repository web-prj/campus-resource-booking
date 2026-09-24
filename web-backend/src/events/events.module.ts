import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { authConfig } from '../config';
import { UsersModule } from '../users/users.module';
import { AvailabilityEventsService } from './availability-events.service';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    // Reuses AuthModule's JwtModule so HTTP and WebSocket sessions verify
    // tokens with one registration. AuthModule depends only on UsersModule, so
    // this import cannot become circular.
    AuthModule,
    UsersModule,
    ConfigModule.forFeature(authConfig),
  ],
  providers: [EventsGateway, AvailabilityEventsService],
  exports: [AvailabilityEventsService],
})
export class EventsModule {}
