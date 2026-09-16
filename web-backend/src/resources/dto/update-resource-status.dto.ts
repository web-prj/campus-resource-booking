import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ResourceStatus } from '../enums/resource-status.enum';

export class UpdateResourceStatusDto {
  @ApiProperty({ enum: ResourceStatus, example: ResourceStatus.MAINTENANCE })
  @IsEnum(ResourceStatus)
  status: ResourceStatus;
}
