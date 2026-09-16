import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resource } from '../entities/resource.entity';
import { ResourceStatus } from '../enums/resource-status.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { BuildingResponseDto } from './building-response.dto';

export class ResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ROOM-A101' })
  code: string;

  @ApiProperty({ example: 'Study Room A101' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ResourceType })
  type: ResourceType;

  @ApiProperty({ enum: ResourceStatus })
  status: ResourceStatus;

  @ApiProperty({ example: 8 })
  capacity: number;

  @ApiProperty({ example: 'First floor' })
  location: string;

  @ApiProperty({ type: [String] })
  amenities: string[];

  @ApiProperty()
  requiresApproval: boolean;

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3, 4, 5, 6],
    description: 'Campus-local weekdays, where Sunday is 0',
  })
  operatingDays: number[];

  @ApiProperty({ example: '08:00' })
  opensAt: string;

  @ApiProperty({ example: '18:00' })
  closesAt: string;

  @ApiProperty({ type: BuildingResponseDto })
  building: BuildingResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(resource: Resource): ResourceResponseDto {
    return {
      id: resource.id,
      code: resource.code,
      name: resource.name,
      description: resource.description,
      type: resource.type,
      status: resource.status,
      capacity: resource.capacity,
      location: resource.location,
      amenities: resource.amenities,
      requiresApproval: resource.requiresApproval,
      operatingDays: resource.operatingDays,
      opensAt: resource.opensAt.slice(0, 5),
      closesAt: resource.closesAt.slice(0, 5),
      building: BuildingResponseDto.fromEntity(resource.building),
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }
}
