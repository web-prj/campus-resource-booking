import { describe, expect, it } from "vitest";
import { isUsthEmail, parseUser } from "./schema";

const validUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("auth schema", () => {
  it("accepts the exact USTH domain", () => {
    expect(isUsthEmail(" Nam.Tran@USTH.EDU.VN ")).toBe(true);
  });

  it.each([
    "student@gmail.com",
    "student@mail.usth.edu.vn",
    "first last@usth.edu.vn",
    "@usth.edu.vn",
  ])("rejects invalid email %j", (email) => {
    expect(isUsthEmail(email)).toBe(false);
  });

  it("parses a valid user response", () => {
    expect(parseUser(validUser)).toEqual(validUser);
  });

  it.each([
    { ...validUser, id: "not-a-uuid" },
    { ...validUser, role: "owner" },
    { ...validUser, createdAt: "not-a-date" },
    { ...validUser, fullName: "" },
    null,
  ])("rejects malformed user response %j", (value) => {
    expect(parseUser(value)).toBeNull();
  });
});
