import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/**
 * In-process notifications about account access changes. Lets long-lived
 * connections (WebSockets) drop a user immediately instead of at token expiry,
 * without the users module depending on the transport.
 */
@Injectable()
export class UserAccessEvents implements OnModuleDestroy {
  private readonly deactivatedSubject = new Subject<string>();

  /** Emits the id of each user an administrator deactivated. */
  readonly deactivated$: Observable<string> =
    this.deactivatedSubject.asObservable();

  publishDeactivated(userId: string): void {
    this.deactivatedSubject.next(userId);
  }

  onModuleDestroy(): void {
    this.deactivatedSubject.complete();
  }
}
