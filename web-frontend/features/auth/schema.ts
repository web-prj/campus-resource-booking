import type { User, UserRole } from "./types";

const USER_ROLES: ReadonlySet<UserRole> = new Set(["student", "staff", "admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USTH_EMAIL_PATTERN = /^[^\s@]+@usth\.edu\.vn$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUsthEmail(value: string): boolean {
  return USTH_EMAIL_PATTERN.test(value.trim());
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isValidRegistrationPassword(value: string): boolean {
  return value.length >= 8 && getUtf8ByteLength(value) <= 72;
}

export function parseUser(value: unknown): User | null {
  if (!isRecord(value)) return null;

  const { id, email, fullName, role, createdAt } = value;
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof email !== "string" ||
    !isUsthEmail(email) ||
    typeof fullName !== "string" ||
    fullName.trim().length === 0 ||
    typeof role !== "string" ||
    !USER_ROLES.has(role as UserRole) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return { id, email, fullName, role: role as UserRole, createdAt };
}
