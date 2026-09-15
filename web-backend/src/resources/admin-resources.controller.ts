import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { BuildingResponseDto } from './dto/building-response.dto';
import { CreateResourceClosureDto } from './dto/create-resource-closure.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourceClosureResponseDto } from './dto/resource-closure-response.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { UpdateResourceStatusDto } from './dto/update-resource-status.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource } from './entities/resource.entity';
import { ResourceCodeAlreadyExistsError } from './errors/resource-code-already-exists.error';
import {
  BuildingNotFoundError,
  InvalidAvailabilityDateError,
  InvalidOperatingHoursError,
  ResourceClosureAlreadyExistsError,
  ResourceNotFoundError,
  ResourcesService,
} from './resources.service';

@ApiTags('admin resources')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Administrator role required' })
@Roles(UserRole.ADMIN)
@Controller('admin/resources')
export class AdminResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List resources for administration' })
  @ApiOkResponse({ type: ResourceResponseDto, isArray: true })
  async findAll(): Promise<ResourceResponseDto[]> {
    return (await this.resourcesService.findAll()).map(
      ResourceResponseDto.fromEntity,
    );
  }

  @Get('buildings')
  @ApiOperation({ summary: 'List buildings available to resources' })
  @ApiOkResponse({ type: BuildingResponseDto, isArray: true })
  async findBuildings(): Promise<BuildingResponseDto[]> {
    return (await this.resourcesService.findBuildings()).map(
      BuildingResponseDto.fromEntity,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a resource' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid resource data' })
  @ApiConflictResponse({ description: 'Resource code already exists' })
  @ApiNotFoundResponse({ description: 'Building not found' })
  async create(@Body() dto: CreateResourceDto): Promise<ResourceResponseDto> {
    return ResourceResponseDto.fromEntity(
      await this.translateErrors(() => this.resourcesService.create(dto)),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid resource data' })
  @ApiConflictResponse({ description: 'Resource code already exists' })
  @ApiNotFoundResponse({ description: 'Resource or building not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    const resource = await this.requireResource(id);
    return ResourceResponseDto.fromEntity(
      await this.translateErrors(() =>
        this.resourcesService.update(resource, dto),
      ),
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change a resource operational status' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid resource status' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceStatusDto,
  ): Promise<ResourceResponseDto> {
    const resource = await this.requireResource(id);
    return ResourceResponseDto.fromEntity(
      await this.translateErrors(() =>
        this.resourcesService.updateStatus(resource, dto.status),
      ),
    );
  }

  @Get(':id/closures')
  @ApiOperation({ summary: 'List scheduled closure dates for a resource' })
  @ApiOkResponse({ type: ResourceClosureResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  async findClosures(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceClosureResponseDto[]> {
    await this.requireResource(id);
    return (await this.resourcesService.findClosures(id)).map(
      ResourceClosureResponseDto.fromEntity,
    );
  }

  @Post(':id/closures')
  @ApiOperation({ summary: 'Close a resource for a campus-local date' })
  @ApiCreatedResponse({ type: ResourceClosureResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid closure date or reason' })
  @ApiConflictResponse({ description: 'Closure already exists for date' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  async createClosure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateResourceClosureDto,
  ): Promise<ResourceClosureResponseDto> {
    await this.requireResource(id);
    return ResourceClosureResponseDto.fromEntity(
      await this.translateErrors(() =>
        this.resourcesService.createClosure(id, dto),
      ),
    );
  }

  @Delete(':id/closures/:closureId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a scheduled resource closure' })
  @ApiNoContentResponse({ description: 'Resource closure removed' })
  @ApiNotFoundResponse({ description: 'Resource or closure not found' })
  async deleteClosure(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closureId', ParseUUIDPipe) closureId: string,
  ): Promise<void> {
    await this.requireResource(id);
    const deleted = await this.translateErrors(() =>
      this.resourcesService.deleteClosure(id, closureId),
    );
    if (!deleted) {
      throw new NotFoundException('Resource closure not found');
    }
  }

  private async requireResource(id: string): Promise<Resource> {
    const resource = await this.resourcesService.findById(id);
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }

  private async translateErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof ResourceCodeAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      if (
        error instanceof BuildingNotFoundError ||
        error instanceof ResourceNotFoundError
      ) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof InvalidOperatingHoursError ||
        error instanceof InvalidAvailabilityDateError
      ) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ResourceClosureAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
