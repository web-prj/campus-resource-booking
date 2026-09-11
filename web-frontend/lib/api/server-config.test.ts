import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerApiEndpoint } from "./server-config";

describe("getServerApiEndpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the internal URL for server-to-server requests", () => {
    vi.stubEnv("INTERNAL_API_URL", "http://backend:3000/api/");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");

    expect(getServerApiEndpoint("/auth/me")).toBe(
      "http://backend:3000/api/auth/me",
    );
  });

  it("falls back to the public API URL outside containers", () => {
    vi.stubEnv("INTERNAL_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api/");

    expect(getServerApiEndpoint("auth/me")).toBe(
      "http://localhost:3000/api/auth/me",
    );
  });
});
