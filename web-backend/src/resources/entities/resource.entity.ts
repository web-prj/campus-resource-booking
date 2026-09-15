import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResourceStatus } from '../enums/resource-status.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { Building } from './building.entity';
import { ResourceClosure } from './resource-closure.entity';

@Entity('resources')
@Check('CHK_resources_capacity_positive', '"capacity" > 0')
@Check(
  'CHK_resources_operating_days_not_empty',
  'cardinality("operating_days") > 0',
)
@Check(
  'CHK_resources_operating_days_range',
  '"operating_days" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]',
)
@Check('CHK_resources_operating_hours_order', '"opens_at" < "closes_at"')
@Check(
  'CHK_resources_operating_hours_whole_hour',
  'EXTRACT(MINUTE FROM "opens_at") = 0 AND EXTRACT(SECOND FROM "opens_at") = 0 AND EXTRACT(MINUTE FROM "closes_at") = 0 AND EXTRACT(SECOND FROM "closes_at") = 0',
)
@Check(
  'CHK_resources_operating_hours_supported_range',
  '"closes_at" <= TIME \'23:00:00\'',
)
@Check(
  'CHK_resources_operating_days_unique',
  'cardinality(array_positions("operating_days", 0)) <= 1 AND cardinality(array_positions("operating_days", 1)) <= 1 AND cardinality(array_positions("operating_days", 2)) <= 1 AND cardinality(array_positions("operating_days", 3)) <= 1 AND cardinality(array_positions("operating_days", 4)) <= 1 AND cardinality(array_positions("operating_days", 5)) <= 1 AND cardinality(array_positions("operating_days", 6)) <= 1',
)
@Index('IDX_resources_operating_days', { synchronize: false })
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_resources_code', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ResourceType })
  type: ResourceType;

  @Column({
    type: 'enum',
    enum: ResourceStatus,
    default: ResourceStatus.ACTIVE,
  })
  status: ResourceStatus;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ type: 'varchar', length: 120 })
  location: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  amenities: string[];

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({
    name: 'operating_days',
    type: 'smallint',
    array: true,
    default: () => "'{1,2,3,4,5,6}'",
  })
  operatingDays: number[];

  @Column({
    name: 'opens_at',
    type: 'time',
    default: () => "'08:00:00'",
  })
  opensAt: string;

  @Column({
    name: 'closes_at',
    type: 'time',
    default: () => "'18:00:00'",
  })
  closesAt: string;

  @OneToMany(() => ResourceClosure, (closure) => closure.resource)
  closures: ResourceClosure[];

  @Index('IDX_resources_building_id')
  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @ManyToOne(() => Building, (building) => building.resources, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'building_id',
    foreignKeyConstraintName: 'FK_resources_building_id',
  })
  building: Building;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
