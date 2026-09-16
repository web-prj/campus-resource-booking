import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import {
  AdminUserPageDto,
  AdminUsersQueryDto,
} from './dto/admin-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserRole } from './enums/user-role.enum';
import {
  LastActiveAdminError,
  SelfManagementNotAllowedError,
  UserNotFoundError,
} from './errors/user-management.error';
import { UsersService } from './users.service';

@ApiTags('admin users')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Administrator role required' })
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list user accounts' })
  @ApiOkResponse({ type: AdminUserPageDto })
  async findAll(@Query() query: AdminUsersQueryDto): Promise<AdminUserPageDto> {
    const page = await this.usersService.findForAdministration(query);
    return {
      ...page,
      items: page.items.map(AdminUserResponseDto.fromEntity),
    };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Assign a user role' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  @ApiBadRequestResponse({
    description: 'Self-management or admin safety rule',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  async updateRole(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminUserResponseDto> {
    return AdminUserResponseDto.fromEntity(
      await this.translateErrors(() =>
        this.usersService.updateRole(actorId, id, dto.role),
      ),
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  @ApiBadRequestResponse({
    description: 'Self-management or admin safety rule',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  async updateStatus(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<AdminUserResponseDto> {
    return AdminUserResponseDto.fromEntity(
      await this.translateErrors(() =>
        this.usersService.updateStatus(actorId, id, dto.isActive),
      ),
    );
  }

  private async translateErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof SelfManagementNotAllowedError ||
        error instanceof LastActiveAdminError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
