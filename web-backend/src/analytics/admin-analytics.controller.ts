import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

@ApiTags('admin analytics')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Administrator role required' })
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'View booking and resource utilization analytics' })
  @ApiOkResponse({ type: AnalyticsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or unsupported date range' })
  getSummary(@Query() query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
    if (query.from > query.to) {
      throw new BadRequestException(
        'The start date must not be after the end date',
      );
    }
    const from = new Date(`${query.from}T00:00:00Z`);
    const to = new Date(`${query.to}T00:00:00Z`);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > 366) {
      throw new BadRequestException('The date range cannot exceed 366 days');
    }
    return this.analyticsService.getSummary(query.from, query.to);
  }
}
