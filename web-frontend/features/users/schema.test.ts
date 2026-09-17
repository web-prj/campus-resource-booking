import { describe, expect, it } from "vitest";
import { parseAdminUser, parseAdminUserPage } from "./schema";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "student",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("admin user schema", () => {
  it("parses the explicit administrative user shape", () => {
    expect(parseAdminUser(user)).toEqual(user);
  });

  it.each([
    { ...user, role: "owner" },
    { ...user, isActive: "true" },
    { ...user, passwordHash: "hash" },
    { ...user, updatedAt: "2025-12-31T23:59:59.000Z" },
    { ...user, email: "outside@example.com" },
  ])("rejects malformed or sensitive account data", (value) => {
    expect(parseAdminUser(value)).toBeNull();
  });

  it("accepts an authoritative empty out-of-range page", () => {
    expect(
      parseAdminUserPage({
        items: [],
        total: 1,
        page: 99,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toEqual({ items: [], total: 1, page: 99, pageSize: 20, totalPages: 1 });
  });

  it("rejects duplicate, incomplete, or unstable page contents", () => {
    const older = {
      ...user,
      id: "22222222-2222-4222-8222-222222222222",
      email: "older@usth.edu.vn",
      createdAt: "2025-12-01T00:00:00.000Z",
      updatedAt: "2025-12-01T00:00:00.000Z",
    };
    expect(
      parseAdminUserPage({
        items: [user, user],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toBeNull();
    expect(
      parseAdminUserPage({
        items: [older, user],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toBeNull();
    expect(
      parseAdminUserPage({
        items: [user],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toBeNull();
  });

  it("validates pagination metadata", () => {
    expect(
      parseAdminUserPage({
        items: [user],
        total: 21,
        page: 2,
        pageSize: 20,
        totalPages: 2,
      }),
    ).toEqual({ items: [user], total: 21, page: 2, pageSize: 20, totalPages: 2 });
    expect(
      parseAdminUserPage({
        items: [user],
        total: 21,
        page: 2,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toBeNull();
  });
});
