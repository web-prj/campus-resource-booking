import { ApiError, browserRequest } from "@/lib/api/browser-client";
import type { UserRole } from "@/features/auth/types";
import { parseAdminUser } from "../schema";
import type { AdminUser } from "../types";

export type UserMutationErrorCode =
  | "validation"
  | "session"
  | "forbidden"
  | "not-found"
  | "network"
  | "unexpected";

export class UserMutationError extends Error {
  constructor(
    public readonly code: UserMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserMutationError";
  }
}

function mutationError(error: unknown): UserMutationError {
  if (error instanceof UserMutationError) return error;
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return new UserMutationError("network", "The user service is unreachable. Check your connection and try again.");
    }
    if (error.status === 400) {
      return new UserMutationError("validation", "This account change is not allowed. Refresh the directory and try again.");
    }
    if (error.status === 401) {
      return new UserMutationError("session", "Your session has ended. Sign in again to manage users.");
    }
    if (error.status === 403) {
      return new UserMutationError("forbidden", "Your account does not have permission to manage users.");
    }
    if (error.status === 404) {
      return new UserMutationError("not-found", "This account no longer exists. Refresh the directory.");
    }
  }
  return new UserMutationError("unexpected", "The account could not be updated. Try again in a moment.");
}

async function mutateUser(
  id: string,
  path: string,
  body: object,
  validate: (user: AdminUser) => boolean,
  request: typeof fetch,
): Promise<AdminUser> {
  try {
    const user = parseAdminUser(
      await browserRequest(`/admin/users/${id}/${path}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }, request),
    );
    if (!user || user.id !== id || !validate(user)) {
      throw new UserMutationError("unexpected", "The user service returned invalid account data.");
    }
    return user;
  } catch (error) {
    throw mutationError(error);
  }
}

export function updateUserRole(
  id: string,
  role: UserRole,
  request: typeof fetch = fetch,
): Promise<AdminUser> {
  return mutateUser(id, "role", { role }, (user) => user.role === role, request);
}

export function updateUserStatus(
  id: string,
  isActive: boolean,
  request: typeof fetch = fetch,
): Promise<AdminUser> {
  return mutateUser(id, "status", { isActive }, (user) => user.isActive === isActive, request);
}
