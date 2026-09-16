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
@Index('IDX_bookings_pending_created_at', ['createdAt'], {
  where: `"status" = 'pending'`,
})
@Index('IDX_bookings_operations_date_status', ['date', 'startTime', 'status'], {
  where: `"status" IN ('confirmed', 'checked_in')`,
})
@Check('CHK_bookings_time_order', '"start_time" < "end_time"')
@Check(
  'CHK_bookings_whole_hour',
  'EXTRACT(MINUTE FROM "start_time") = 0 AND EXTRACT(SECOND FROM "start_time") = 0 AND EXTRACT(MINUTE FROM "end_time") = 0 AND EXTRACT(SECOND FROM "end_time") = 0',
)
@Check('CHK_bookings_supported_time_range', '"end_time" <= TIME \'23:00:00\'')
@Check(
  'CHK_bookings_cancellation_state',
  `("status" = 'cancelled' AND "cancelled_at" IS NOT NULL) OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)`,
)
@Check(
  'CHK_bookings_pending_unreviewed',
  `"status" <> 'pending' OR "reviewed_at" IS NULL`,
)
@Check(
  'CHK_bookings_review_pair',
  `("reviewed_at" IS NULL AND "reviewed_by_id" IS NULL) OR ("reviewed_at" IS NOT NULL AND "reviewed_by_id" IS NOT NULL)`,
)
@Check(
  'CHK_bookings_rejection_state',
  `("status" = 'rejected' AND "rejection_reason" IS NOT NULL AND "reviewed_at" IS NOT NULL) OR ("status" <> 'rejected' AND "rejection_reason" IS NULL)`,
)
@Check(
  'CHK_bookings_check_in_request',
  `("check_in_code" IS NULL AND "check_in_requested_at" IS NULL) OR ("check_in_code" ~ '^[0-9]{6}$' AND "check_in_requested_at" IS NOT NULL)`,
)
@Check(
  'CHK_bookings_checked_in_state',
  `("status" IN ('checked_in', 'completed') AND "check_in_code" IS NOT NULL AND "checked_in_at" IS NOT NULL AND "checked_in_by_id" IS NOT NULL) OR ("status" NOT IN ('checked_in', 'completed') AND "checked_in_at" IS NULL AND "checked_in_by_id" IS NULL)`,
)
@Check(
  'CHK_bookings_checkout_state',
  `("status" = 'completed' AND "checked_out_at" IS NOT NULL AND "checked_out_by_id" IS NOT NULL) OR ("status" <> 'completed' AND "checked_out_at" IS NULL AND "checked_out_by_id" IS NULL)`,
)
@Check(
  'CHK_bookings_no_show_state',
  `("status" = 'no_show' AND "no_show_at" IS NOT NULL AND "no_show_by_id" IS NOT NULL) OR ("status" <> 'no_show' AND "no_show_at" IS NULL AND "no_show_by_id" IS NULL)`,
)
@Exclusion(
  'EXCL_bookings_resource_period_blocking',
  `USING gist ("resource_id" WITH =, "booking_period" WITH &&) WHERE ("status" IN ('pending', 'confirmed', 'checked_in'))`,
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

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'reviewed_by_id',
    foreignKeyConstraintName: 'FK_bookings_reviewed_by_id',
  })
  reviewer: User | null;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({ name: 'check_in_code', type: 'varchar', length: 6, nullable: true })
  checkInCode: string | null;

  @Column({
    name: 'check_in_requested_at',
    type: 'timestamptz',
    nullable: true,
  })
  checkInRequestedAt: Date | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ name: 'checked_in_by_id', type: 'uuid', nullable: true })
  checkedInById: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'checked_in_by_id',
    foreignKeyConstraintName: 'FK_bookings_checked_in_by_id',
  })
  checkedInBy: User | null;

  @Column({ name: 'checked_out_at', type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  @Column({ name: 'checked_out_by_id', type: 'uuid', nullable: true })
  checkedOutById: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'checked_out_by_id',
    foreignKeyConstraintName: 'FK_bookings_checked_out_by_id',
  })
  checkedOutBy: User | null;

  @Column({ name: 'no_show_at', type: 'timestamptz', nullable: true })
  noShowAt: Date | null;

  @Column({ name: 'no_show_by_id', type: 'uuid', nullable: true })
  noShowById: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'no_show_by_id',
    foreignKeyConstraintName: 'FK_bookings_no_show_by_id',
  })
  noShowBy: User | null;

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
