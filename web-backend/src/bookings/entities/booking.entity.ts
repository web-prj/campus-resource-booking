import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resource } from '../../resources/entities/resource.entity';
import { User } from '../../users/entities/user.entity';
import { BookingStatus } from '../enums/booking-status.enum';

@Entity('bookings')
@Index('IDX_bookings_resource_date', ['resourceId', 'date'])
@Index('IDX_bookings_requester_created_at', ['requesterId', 'createdAt'])
@Check('CHK_bookings_time_order', '"start_time" < "end_time"')
@Check(
  'CHK_bookings_whole_hour',
  'EXTRACT(MINUTE FROM "start_time") = 0 AND EXTRACT(SECOND FROM "start_time") = 0 AND EXTRACT(MINUTE FROM "end_time") = 0 AND EXTRACT(SECOND FROM "end_time") = 0',
)
@Check('CHK_bookings_supported_time_range', '"end_time" <= TIME \'23:00:00\'')
@Exclusion(
  'EXCL_bookings_resource_period_blocking',
  `USING gist ("resource_id" WITH =, "booking_period" WITH &&) WHERE ("status" IN ('pending', 'confirmed'))`,
)
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @ManyToOne(() => Resource, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'resource_id',
    foreignKeyConstraintName: 'FK_bookings_resource_id',
  })
  resource: Resource;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'requester_id',
    foreignKeyConstraintName: 'FK_bookings_requester_id',
  })
  requester: User;

  @Column({ name: 'booking_date', type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'enum', enum: BookingStatus })
  status: BookingStatus;

  @Column({
    name: 'booking_period',
    type: 'tsrange',
    asExpression: `tsrange(LEAST("booking_date" + "start_time", "booking_date" + "end_time"), GREATEST("booking_date" + "start_time", "booking_date" + "end_time"), '[)')`,
    generatedType: 'STORED',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  bookingPeriod: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
