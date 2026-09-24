import "server-only";

import { cookies } from "next/headers";
import { getServerApiEndpoint } from "@/lib/api/server-config";
import { assertSessionActive } from "@/lib/api/session";
import { parseAdminUserPage } from "../schema";
import type { AdminUserFilters, AdminUserPage } from "../types";

export async function getAdminUsers(
  filters: AdminUserFilters,
  request: typeof fetch = fetch,
): Promise<AdminUserPage> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: "20",
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) {
    params.set("isActive", String(filters.status === "active"));
  }

  const cookieHeader = (await cookies()).toString();
  let response: Response;
  try {
    response = await request(
      getServerApiEndpoint(`/admin/users?${params.toString()}`),
      {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        cache: "no-store",
      },
    );
  } catch {
    throw new Error("The user service is unavailable.");
  }
  assertSessionActive(response);
  if (!response.ok) throw new Error(`User lookup failed with ${response.status}.`);

  const page = parseAdminUserPage(await response.json().catch(() => null));
  if (!page || page.page !== (filters.page ?? 1) || page.pageSize !== 20) {
    throw new Error("The user service returned invalid directory data.");
  }
  return page;
}
