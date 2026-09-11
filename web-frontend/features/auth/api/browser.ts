import { ApiError, browserRequest } from "@/lib/api/browser-client";
import { parseUser } from "../schema";
import type {
  LoginCredentials,
  RegisterCredentials,
  User,
} from "../types";

export type LoginErrorCode =
  | "validation"
  | "credentials"
  | "rate-limit"
  | "network"
  | "unexpected";

export class LoginError extends Error {
  constructor(
    public readonly code: LoginErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LoginError";
  }
}

const messages: Record<LoginErrorCode, string> = {
  validation: "Use your USTH email address and check the form fields.",
  credentials: "The email or password is incorrect.",
  "rate-limit": "Too many sign-in attempts. Wait a minute, then try again.",
  network: "The booking service is unreachable. Check your connection and try again.",
  unexpected: "Sign-in could not be completed. Try again in a moment.",
};

function loginCodeFor(error: ApiError): LoginErrorCode {
  if (error.kind === "network") return "network";
  if (error.status === 400) return "validation";
  if (error.status === 401) return "credentials";
  if (error.status === 429) return "rate-limit";
  return "unexpected";
}

export async function login(
  credentials: LoginCredentials,
  request: typeof fetch = fetch,
): Promise<User> {
  try {
    const body = await browserRequest(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        }),
      },
      request,
    );
    const user = parseUser(body);
    if (!user) throw new LoginError("unexpected", messages.unexpected);
    return user;
  } catch (error) {
    if (error instanceof LoginError) throw error;
    if (error instanceof ApiError) {
      const code = loginCodeFor(error);
      throw new LoginError(code, messages[code]);
    }
    throw new LoginError("unexpected", messages.unexpected);
  }
}

export type RegistrationErrorCode =
  | "validation"
  | "duplicate"
  | "rate-limit"
  | "network"
  | "unexpected";

export class RegistrationError extends Error {
  constructor(
    public readonly code: RegistrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

const registrationMessages: Record<RegistrationErrorCode, string> = {
  validation: "Check your name, USTH email, and password requirements.",
  duplicate: "An account already exists for this USTH email. Sign in instead.",
  "rate-limit": "Too many registration attempts. Wait a minute, then try again.",
  network: "The booking service is unreachable. Check your connection and try again.",
  unexpected: "Your account could not be created. Try again in a moment.",
};

function registrationCodeFor(error: ApiError): RegistrationErrorCode {
  if (error.kind === "network") return "network";
  if (error.status === 400) return "validation";
  if (error.status === 409) return "duplicate";
  if (error.status === 429) return "rate-limit";
  return "unexpected";
}

export async function register(
  credentials: RegisterCredentials,
  request: typeof fetch = fetch,
): Promise<User> {
  try {
    const body = await browserRequest(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
          fullName: credentials.fullName.trim(),
        }),
      },
      request,
    );
    const user = parseUser(body);
    if (!user) {
      throw new RegistrationError("unexpected", registrationMessages.unexpected);
    }
    return user;
  } catch (error) {
    if (error instanceof RegistrationError) throw error;
    if (error instanceof ApiError) {
      const code = registrationCodeFor(error);
      throw new RegistrationError(code, registrationMessages[code]);
    }
    throw new RegistrationError("unexpected", registrationMessages.unexpected);
  }
}

export async function logout(request: typeof fetch = fetch): Promise<void> {
  await browserRequest("/auth/logout", { method: "POST" }, request);
}
