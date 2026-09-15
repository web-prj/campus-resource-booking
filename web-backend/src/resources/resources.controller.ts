import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DiscoverResourcesQueryDto } from './dto/discover-resources-query.dto';
import { ResourceAvailabilityQueryDto } from './dto/resource-availability-query.dto';
import { ResourceAvailabilityResponseDto } from './dto/resource-availability-response.dto';
import { BuildingResponseDto } from './dto/building-response.dto';
import { ResourcePageResponseDto } from './dto/resource-page-response.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';
import {
  InvalidAvailabilityDateError,
  InvalidAvailabilityRangeError,
  ResourcesService,
} from './resources.service';

@ApiTags('resources')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'Discover active campus resources' })
  @ApiOkResponse({ type: ResourcePageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid discovery filters' })
  async discover(
    @Query() query: DiscoverResourcesQueryDto,
  ): Promise<ResourcePageResponseDto> {
    try {
      const [items, total] = await this.resourcesService.discover(query);
      return ResourcePageResponseDto.fromEntities(
        items,
        total,
        query.page,
        query.pageSize,
      );
    } catch (error: unknown) {
      this.translateAvailabilityError(error);
    }
  }

  @Get('buildings')
  @ApiOperation({ summary: 'List buildings available for discovery filters' })
  @ApiOkResponse({ type: BuildingResponseDto, isArray: true })
  async findBuildings(): Promise<BuildingResponseDto[]> {
    return (await this.resourcesService.findBuildings()).map(
      BuildingResponseDto.fromEntity,
    );
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'List operationally available slots for a date' })
  @ApiOkResponse({ type: ResourceAvailabilityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid availability date' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  async findAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ResourceAvailabilityQueryDto,
  ): Promise<ResourceAvailabilityResponseDto> {
    const resource = await this.resourcesService.findById(id);
    if (!resource) throw new NotFoundException('Resource not found');

    try {
      const [closure, bookings] = await Promise.all([
        this.resourcesService.findClosure(id, query.date),
        this.resourcesService.findBlockingBookings(id, query.date),
      ]);
      return ResourceAvailabilityResponseDto.fromResource(
        resource,
        query.date,
        closure,
        bookings,
        this.resourcesService.currentTime(),
      );
    } catch (error: unknown) {
      this.translateAvailabilityError(error);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'View an active campus resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponseDto> {
    const resource = await this.resourcesService.findDiscoverableById(id);
    if (!resource) throw new NotFoundException('Resource not found');
    return ResourceResponseDto.fromEntity(resource);
  }

  private translateAvailabilityError(error: unknown): never {
    if (
      error instanceof InvalidAvailabilityDateError ||
      error instanceof InvalidAvailabilityRangeError
    ) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
