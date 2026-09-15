import { ApiProperty } from '@nestjs/swagger';
import { Resource } from '../entities/resource.entity';
import { ResourceResponseDto } from './resource-response.dto';

export class ResourcePageResponseDto {
  @ApiProperty({ type: ResourceResponseDto, isArray: true })
  items: ResourceResponseDto[];

  @ApiProperty({ example: 24 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 9 })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  static fromEntities(
    items: Resource[],
    total: number,
    page: number,
    pageSize: number,
  ): ResourcePageResponseDto {
    return {
      items: items.map(ResourceResponseDto.fromEntity),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
