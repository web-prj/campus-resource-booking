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

/** A staff or admin account provisioned from configuration at startup. */
export interface BootstrapAccountData {
  email: string;
  fullName: string;
  role: UserRole.ADMIN | UserRole.STAFF;
  /** Needed only to create the account when it does not exist yet. */
  passwordHash?: string;
}
