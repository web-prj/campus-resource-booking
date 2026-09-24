import { redirect } from "next/navigation";
import { getSafeRedirect } from "@/features/auth/routing";

/**
 * Thrown by server-side API fetchers when the backend rejects the session
 * cookie (HTTP 401) after the page has already resolved the current user.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("The session has expired.");
    this.name = "SessionExpiredError";
  }
}

export function assertSessionActive(response: { status: number }): void {
  if (response.status === 401) throw new SessionExpiredError();
}

export function loginRedirectPath(returnTo: string): string {
  const next = getSafeRedirect(returnTo);
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * Runs server-side data loading for a protected route. When the session
 * expires between the user lookup and the data fetch, the visitor is sent to
 * sign in again and then returned to the same route instead of seeing the
 * generic error boundary.
 */
export async function withSessionRedirect<T>(
  returnTo: string,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(loginRedirectPath(returnTo));
    throw error;
  }
}
