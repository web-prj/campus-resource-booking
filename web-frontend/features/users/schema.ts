import { isUsthEmail } from "@/features/auth/schema";
import type { UserRole } from "@/features/auth/types";
import type { AdminUser, AdminUserPage } from "./types";

const ROLES: ReadonlySet<UserRole> = new Set(["student", "staff", "admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAdminUser(value: unknown): AdminUser | null {
  if (!isRecord(value)) return null;
  const { id, email, fullName, role, isActive, createdAt, updatedAt } = value;
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof email !== "string" ||
    !isUsthEmail(email) ||
    typeof fullName !== "string" ||
    fullName.trim().length === 0 ||
    typeof role !== "string" ||
    !ROLES.has(role as UserRole) ||
    typeof isActive !== "boolean" ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt)) ||
    typeof updatedAt !== "string" ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    return null;
  }
  return {
    id,
    email,
    fullName,
    role: role as UserRole,
    isActive,
    createdAt,
    updatedAt,
  };
}

export function parseAdminUserPage(value: unknown): AdminUserPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const { total, page, pageSize, totalPages } = value;
  const items = value.items.map(parseAdminUser);
  if (
    items.some((user) => user === null) ||
    typeof total !== "number" ||
    !Number.isInteger(total) ||
    total < 0 ||
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    typeof totalPages !== "number" ||
    !Number.isInteger(totalPages) ||
    totalPages !== (total === 0 ? 0 : Math.ceil(total / pageSize)) ||
    items.length > pageSize ||
    (total === 0 ? items.length !== 0 || page !== 1 : page > totalPages)
  ) {
    return null;
  }
  return { items: items as AdminUser[], total, page, pageSize, totalPages };
}
