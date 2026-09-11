import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

/**
 * What the JWT strategy attaches to the request. Typing it here removes the
 * `any` casts that otherwise spread through guards and decorators.
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}
