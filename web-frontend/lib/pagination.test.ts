import { describe, expect, it } from "vitest";
import { lastPageFor, parsePageParam } from "./pagination";

describe("page parameters", () => {
  it("accepts positive whole page numbers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("12")).toBe(12);
  });

  it.each([undefined, "", "0", "-1", "1.5", "2e3", " 2", "abc", ["2"], "99999999999999999999"])(
    "falls back to page 1 for %o",
    (value) => {
      expect(parsePageParam(value)).toBe(1);
    },
  );

  it("treats an empty result as a single last page", () => {
    expect(lastPageFor(0)).toBe(1);
    expect(lastPageFor(4)).toBe(4);
  });
});
