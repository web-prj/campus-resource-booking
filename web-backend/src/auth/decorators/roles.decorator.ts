import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { ROLES_KEY } from '../auth.constants';

/**
 * Restricts a route to the listed roles. Enforced by RolesGuard, which runs
 * after authentication so `request.user` is already populated.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
