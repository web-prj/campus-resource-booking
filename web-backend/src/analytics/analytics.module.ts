import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Resource, ResourceClosure])],
  controllers: [AdminAnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
