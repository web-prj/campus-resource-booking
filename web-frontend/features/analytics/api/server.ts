import "server-only";

import { cookies } from "next/headers";
import { getServerApiEndpoint } from "@/lib/api/server-config";
import { assertSessionActive } from "@/lib/api/session";
import { parseAnalyticsSummary } from "../schema";
import type { AnalyticsRange, AnalyticsSummary } from "../types";

export async function getAdminAnalytics(
  range: AnalyticsRange,
  request: typeof fetch = fetch,
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  const cookieHeader = (await cookies()).toString();
  let response: Response;
  try {
    response = await request(
      getServerApiEndpoint(`/admin/analytics?${params.toString()}`),
      {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        cache: "no-store",
      },
    );
  } catch {
    throw new Error("The analytics service is unavailable.");
  }
  assertSessionActive(response);
  if (!response.ok) throw new Error(`Analytics lookup failed with ${response.status}.`);
  const summary = parseAnalyticsSummary(await response.json().catch(() => null));
  if (!summary || summary.from !== range.from || summary.to !== range.to) {
    throw new Error("The analytics service returned invalid summary data.");
  }
  return summary;
}
