import { ApiProperty } from '@nestjs/swagger';
import { Building } from '../entities/building.entity';

export class BuildingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MAIN' })
  code: string;

  @ApiProperty({ example: 'Main Academic Building' })
  name: string;

  @ApiProperty({ example: 'USTH Campus, Hanoi' })
  address: string;

  static fromEntity(building: Building): BuildingResponseDto {
    return {
      id: building.id,
      code: building.code,
      name: building.name,
      address: building.address,
    };
  }
}
