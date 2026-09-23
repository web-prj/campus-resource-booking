import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CAMPUS_CLOCK } from '../common/time/campus-clock';
import { BookingsController } from './bookings.controller';
import { StaffBookingsController } from './staff-bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), EventsModule],
  controllers: [BookingsController, StaffBookingsController],
  providers: [
    BookingsService,
    { provide: CAMPUS_CLOCK, useValue: () => new Date() },
  ],
})
export class BookingsModule {}
