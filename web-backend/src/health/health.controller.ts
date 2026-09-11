import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  // Probes run without credentials, so this one route opts out of the guard.
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness and database connectivity check' })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
