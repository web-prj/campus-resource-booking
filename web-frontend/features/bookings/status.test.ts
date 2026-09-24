import { describe, expect, it } from "vitest";
import { isExpiredRequest, studentDisplayStatus, studentStatusLabel } from "./status";

describe("student booking display status", () => {
  it("presents an ended pending request as expired", () => {
    const booking = { status: "pending" as const, hasEnded: true };
    expect(isExpiredRequest(booking)).toBe(true);
    expect(studentDisplayStatus(booking)).toBe("expired");
    expect(studentStatusLabel(booking)).toBe("Expired request");
  });

  it("keeps other statuses unchanged", () => {
    expect(studentStatusLabel({ status: "pending", hasEnded: false })).toBe("Pending approval");
    expect(studentStatusLabel({ status: "confirmed", hasEnded: true })).toBe("Confirmed");
    expect(isExpiredRequest({ status: "rejected", hasEnded: true })).toBe(false);
  });
});
