import { describe, expect, it } from "vitest";
import { parseBookingRequestResult } from "./schema";

const requesterId = "30000000-0000-4000-8000-000000000001";
const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};
const result = {
  id: "40000000-0000-4000-8000-000000000001",
  requesterId,
  ...input,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
};

describe("booking response schema", () => {
  it.each(["confirmed", "pending"] as const)(
    "parses a scoped %s booking response",
    (status) => {
      expect(
        parseBookingRequestResult({ ...result, status }, input, requesterId),
      ).toEqual({ ...result, status });
    },
  );

  it.each([
    { ...result, id: "bad" },
    { ...result, resourceId: "20000000-0000-4000-8000-000000000002" },
    { ...result, requesterId: "30000000-0000-4000-8000-000000000002" },
    { ...result, date: "2099-01-06" },
    { ...result, startTime: "10:00" },
    { ...result, endTime: "11:00" },
    { ...result, status: "cancelled" },
    { ...result, timeZone: "UTC" },
    { ...result, createdAt: "bad" },
  ])("rejects malformed or out-of-scope booking data", (value) => {
    expect(parseBookingRequestResult(value, input, requesterId)).toBeNull();
  });
});
