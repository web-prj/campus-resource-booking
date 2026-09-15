import { ApiProperty } from '@nestjs/swagger';
import { ResourceClosure } from '../entities/resource-closure.entity';

export class ResourceClosureResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ example: '2026-09-18' })
  date: string;

  @ApiProperty({ example: 'Scheduled campus maintenance' })
  reason: string;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(closure: ResourceClosure): ResourceClosureResponseDto {
    return {
      id: closure.id,
      resourceId: closure.resourceId,
      date: closure.date,
      reason: closure.reason,
      createdAt: closure.createdAt,
    };
  }
}
