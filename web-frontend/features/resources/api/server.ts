import "server-only";

import { cookies } from "next/headers";
import { getServerApiEndpoint } from "@/lib/api/server-config";
import { assertSessionActive } from "@/lib/api/session";
import {
  parseBuildings,
  parseResource,
  parseResourceAvailability,
  parseResourcePage,
} from "../schema";
import { discoverySearchParams } from "../discovery-query";
import type {
  Building,
  Resource,
  ResourceAvailability,
  ResourceDiscoveryFilters,
  ResourcePage,
} from "../types";

async function resourceRequest(
  path: string,
  request: typeof fetch,
): Promise<{ status: number; body: unknown }> {
  const cookieHeader = (await cookies()).toString();
  let response: Response;

  try {
    response = await request(getServerApiEndpoint(path), {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("The resource service is unavailable.");
  }

  assertSessionActive(response);
  const body = await response.json().catch(() => null);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Resource lookup failed with ${response.status}.`);
  }

  return { status: response.status, body };
}

export const ADMIN_RESOURCE_PAGE_SIZE = 20;

export async function getAdminResourceCatalog(
  page = 1,
  request: typeof fetch = fetch,
): Promise<{ page: ResourcePage; buildings: Building[] }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(ADMIN_RESOURCE_PAGE_SIZE),
  });
  const [resourceResponse, buildingResponse] = await Promise.all([
    resourceRequest(`/admin/resources?${params.toString()}`, request),
    resourceRequest("/admin/resources/buildings", request),
  ]);
  const resourcePage = parseResourcePage(resourceResponse.body, 50);
  const buildings = parseBuildings(buildingResponse.body);

  if (
    !resourcePage ||
    !buildings ||
    resourcePage.page !== page ||
    resourcePage.pageSize !== ADMIN_RESOURCE_PAGE_SIZE
  ) {
    throw new Error("The resource service returned invalid catalog data.");
  }

  return { page: resourcePage, buildings };
}

export async function getResourceDirectory(
  filters: ResourceDiscoveryFilters,
  request: typeof fetch = fetch,
): Promise<{ page: ResourcePage; buildings: Building[] }> {
  const params = discoverySearchParams(filters);
  params.set("pageSize", "9");
  const query = params.toString();

  const [resourceResponse, buildingResponse] = await Promise.all([
    resourceRequest(`/resources?${query}`, request),
    resourceRequest("/resources/buildings", request),
  ]);
  const page = parseResourcePage(resourceResponse.body);
  const buildings = parseBuildings(buildingResponse.body);

  const requestedPage = filters.page ?? 1;
  if (
    !page ||
    !buildings ||
    page.page !== requestedPage ||
    page.pageSize !== 9 ||
    page.items.some((resource) => resource.status !== "active")
  ) {
    throw new Error("The resource service returned invalid discovery data.");
  }

  return { page, buildings };
}

export async function getResourceAvailability(
  id: string,
  date: string,
  request: typeof fetch = fetch,
): Promise<ResourceAvailability | null> {
  const response = await resourceRequest(
    `/resources/${id}/availability?date=${encodeURIComponent(date)}`,
    request,
  );
  if (response.status === 404) return null;

  const availability = parseResourceAvailability(response.body);
  if (
    !availability ||
    availability.resourceId !== id ||
    availability.date !== date
  ) {
    throw new Error("The resource service returned invalid availability data.");
  }
  return availability;
}

export async function getResourceDetail(
  id: string,
  request: typeof fetch = fetch,
): Promise<Resource | null> {
  const response = await resourceRequest(`/resources/${id}`, request);
  if (response.status === 404) return null;

  const resource = parseResource(response.body);
  if (!resource || resource.id !== id || resource.status !== "active") {
    throw new Error("The resource service returned invalid resource data.");
  }
  return resource;
}
