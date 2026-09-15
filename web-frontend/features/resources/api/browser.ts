import { ApiError, browserRequest } from "@/lib/api/browser-client";
import {
  parseResource,
  parseResourceClosure,
  parseResourceClosures,
} from "../schema";
import type {
  Resource,
  ResourceClosure,
  ResourceInput,
  ResourceStatus,
} from "../types";

export type ResourceMutationErrorCode =
  | "validation"
  | "session"
  | "conflict"
  | "not-found"
  | "forbidden"
  | "network"
  | "unexpected";

export class ResourceMutationError extends Error {
  constructor(
    public readonly code: ResourceMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResourceMutationError";
  }
}

const messages: Record<ResourceMutationErrorCode, string> = {
  validation: "Check the resource details and try again.",
  session: "Your session has ended. Sign in again to manage resources.",
  conflict: "A resource with this code already exists.",
  "not-found":
    "The resource or building no longer exists. Refresh and try again.",
  forbidden: "Your account does not have permission to manage resources.",
  network:
    "The resource service is unreachable. Check your connection and try again.",
  unexpected: "The resource could not be saved. Try again in a moment.",
};

function errorCodeFor(error: ApiError): ResourceMutationErrorCode {
  if (error.kind === "network") return "network";
  if (error.status === 400) return "validation";
  if (error.status === 401) return "session";
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  if (error.status === 409) return "conflict";
  return "unexpected";
}

async function mutateResource(
  path: string,
  init: RequestInit,
  request: typeof fetch,
  validate?: (resource: Resource) => boolean,
): Promise<Resource> {
  try {
    const resource = parseResource(await browserRequest(path, init, request));
    if (!resource || (validate && !validate(resource))) {
      throw new ResourceMutationError("unexpected", messages.unexpected);
    }
    return resource;
  } catch (error) {
    if (error instanceof ResourceMutationError) throw error;
    if (error instanceof ApiError) {
      const code = errorCodeFor(error);
      throw new ResourceMutationError(code, messages[code]);
    }
    throw new ResourceMutationError("unexpected", messages.unexpected);
  }
}

export function createResource(
  input: ResourceInput,
  request: typeof fetch = fetch,
): Promise<Resource> {
  return mutateResource(
    "/admin/resources",
    { method: "POST", body: JSON.stringify(input) },
    request,
  );
}

export function updateResource(
  id: string,
  input: ResourceInput,
  request: typeof fetch = fetch,
): Promise<Resource> {
  return mutateResource(
    `/admin/resources/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    request,
    (resource) => resource.id === id,
  );
}

export function updateResourceStatus(
  id: string,
  status: ResourceStatus,
  request: typeof fetch = fetch,
): Promise<Resource> {
  return mutateResource(
    `/admin/resources/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
    request,
    (resource) => resource.id === id && resource.status === status,
  );
}

function closureError(error: unknown): ResourceMutationError {
  if (error instanceof ResourceMutationError) return error;
  if (error instanceof ApiError) {
    const code = errorCodeFor(error);
    const message =
      code === "conflict"
        ? "A closure already exists for this resource and date."
        : code === "validation"
          ? "Enter a valid closure date and reason."
          : messages[code];
    return new ResourceMutationError(code, message);
  }
  return new ResourceMutationError(
    "unexpected",
    "The closure schedule could not be updated. Try again in a moment.",
  );
}

export async function getResourceClosures(
  resourceId: string,
  request: typeof fetch = fetch,
): Promise<ResourceClosure[]> {
  try {
    const closures = parseResourceClosures(
      await browserRequest(`/admin/resources/${resourceId}/closures`, {}, request),
    );
    if (
      !closures ||
      closures.some((closure) => closure.resourceId !== resourceId)
    ) {
      throw new ResourceMutationError("unexpected", messages.unexpected);
    }
    return closures;
  } catch (error) {
    throw closureError(error);
  }
}

export async function createResourceClosure(
  resourceId: string,
  input: { date: string; reason: string },
  request: typeof fetch = fetch,
): Promise<ResourceClosure> {
  try {
    const closure = parseResourceClosure(
      await browserRequest(
        `/admin/resources/${resourceId}/closures`,
        { method: "POST", body: JSON.stringify(input) },
        request,
      ),
    );
    if (!closure || closure.resourceId !== resourceId) {
      throw new ResourceMutationError("unexpected", messages.unexpected);
    }
    return closure;
  } catch (error) {
    throw closureError(error);
  }
}

export async function deleteResourceClosure(
  resourceId: string,
  closureId: string,
  request: typeof fetch = fetch,
): Promise<void> {
  try {
    await browserRequest(
      `/admin/resources/${resourceId}/closures/${closureId}`,
      { method: "DELETE" },
      request,
    );
  } catch (error) {
    throw closureError(error);
  }
}
