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
    { ...user, passwordHash: "hash", email: "outside@example.com" },
  ])("rejects malformed account data", (value) => {
    expect(parseAdminUser(value)).toBeNull();
  });

  it("validates pagination metadata", () => {
    expect(
      parseAdminUserPage({
        items: [user],
        total: 21,
        page: 1,
        pageSize: 20,
        totalPages: 2,
      }),
    ).toEqual({ items: [user], total: 21, page: 1, pageSize: 20, totalPages: 2 });
    expect(
      parseAdminUserPage({
        items: [user],
        total: 21,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    ).toBeNull();
  });
});
