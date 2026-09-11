import { UserRole } from '../enums/user-role.enum';

/**
 * Internal shape for persisting a user. It takes a hash, never a raw password,
 * so hashing cannot be forgotten at a call site.
 */
export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  role?: UserRole;
}
