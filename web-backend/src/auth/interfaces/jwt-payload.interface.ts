import { UserRole } from '../../users/enums/user-role.enum';

/** Claims this app puts in the token. Kept minimal; the DB stays authoritative. */
export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string;
  role: UserRole;
}

/** Registered claims added by the signing library. */
export interface JwtPayloadWithTiming extends JwtPayload {
  iat: number;
  exp: number;
}
