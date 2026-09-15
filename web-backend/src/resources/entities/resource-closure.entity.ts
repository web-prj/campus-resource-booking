import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resource } from './resource.entity';

@Entity('resource_closures')
@Check(
  'CHK_resource_closures_reason_length',
  `char_length(regexp_replace("reason", '^[[:space:]]+|[[:space:]]+$', '', 'g')) >= 2`,
)
@Index('IDX_resource_closures_resource_date', ['resourceId', 'date'], {
  unique: true,
})
export class ResourceClosure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @ManyToOne(() => Resource, (resource) => resource.closures, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'resource_id',
    foreignKeyConstraintName: 'FK_resource_closures_resource_id',
  })
  resource: Resource;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
