import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Injects the authenticated user, or one of its properties:
 *
 *   me(@CurrentUser() user: User)
 *   me(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  <K extends keyof User>(property: K | undefined, ctx: ExecutionContext) => {
    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return property ? user?.[property] : user;
  },
);
