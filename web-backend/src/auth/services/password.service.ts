import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthConfig, authConfig } from '../../config';

/**
 * Hashing and verification. Kept separate from AuthService so the algorithm and
 * its timing defences live in one place.
 */
@Injectable()
export class PasswordService {
  /**
   * A hash of a throwaway value, compared against when no account is found so a
   * login attempt costs the same whether or not the email exists. Without it,
   * response timing reveals which addresses are registered.
   */
  private readonly dummyHash: string;

  constructor(@Inject(authConfig.KEY) private readonly config: AuthConfig) {
    this.dummyHash = bcrypt.hashSync(
      'no-user-timing-equalizer-placeholder',
      this.config.bcryptRounds,
    );
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verifies a password against a hash. Pass `null` when the account was not
   * found: the comparison still runs, against the dummy hash, and returns false.
   */
  compare(password: string, hash: string | null | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? this.dummyHash);
  }
}
