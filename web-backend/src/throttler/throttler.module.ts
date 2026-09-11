import { ExecutionContext, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottleConfig, throttleConfig } from '../config';
import { STRICT_RATE_LIMIT_KEY } from './decorators/strict-rate-limit.decorator';

/**
 * One throttler for the whole API, with a per-route limit resolver: routes
 * marked `@StrictRateLimit()` get the smaller auth budget. Counters are keyed
 * per route by the guard, so a slow login does not consume a user's read quota.
 *
 * The default storage is in-memory and therefore per-instance. Swap in the Redis
 * storage when the app is scaled out (the proposal already plans Redis).
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [...throttleConfig.asProvider().imports],
      inject: [throttleConfig.KEY, Reflector],
      useFactory: (config: ThrottleConfig, reflector: Reflector) => ({
        throttlers: [
          {
            // v6 expects milliseconds; the env value is expressed in seconds.
            ttl: config.ttl * 1000,
            limit: (context: ExecutionContext) =>
              reflector.getAllAndOverride<boolean>(STRICT_RATE_LIMIT_KEY, [
                context.getHandler(),
                context.getClass(),
              ])
                ? config.authLimit
                : config.limit,
          },
        ],
      }),
    }),
  ],
})
export class ThrottlerConfigModule {}
