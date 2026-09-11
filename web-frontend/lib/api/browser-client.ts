import { getApiEndpoint } from "./config";

export type ApiErrorKind = "http" | "network" | "invalid-response";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function browserRequest(
  path: string,
  init: RequestInit = {},
  request: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;

  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    response = await request(getApiEndpoint(path), {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError("network", "The API could not be reached.");
  }

  if (!response.ok) {
    throw new ApiError("http", `The API returned ${response.status}.`, response.status);
  }

  if (response.status === 204) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError("invalid-response", "The API returned invalid JSON.");
  }
}
