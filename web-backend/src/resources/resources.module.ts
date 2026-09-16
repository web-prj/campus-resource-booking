import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { CAMPUS_CLOCK } from '../common/time/campus-clock';
import { AdminResourcesController } from './admin-resources.controller';
import { ResourcesController } from './resources.controller';
import { Building } from './entities/building.entity';
import { ResourceClosure } from './entities/resource-closure.entity';
import { Resource } from './entities/resource.entity';
import { ResourcesService } from './resources.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Building, Resource, ResourceClosure, Booking]),
  ],
  controllers: [AdminResourcesController, ResourcesController],
  providers: [
    ResourcesService,
    { provide: CAMPUS_CLOCK, useValue: () => new Date() },
  ],
})
export class ResourcesModule {}
