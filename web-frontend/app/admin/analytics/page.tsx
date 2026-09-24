import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminAnalytics } from "@/features/analytics/api/server";
import { AdminAnalytics } from "@/features/analytics/components/admin-analytics";
import type { AnalyticsRange } from "@/features/analytics/types";
import { getCurrentUser } from "@/features/auth/api/server";
import { loginRedirectPath, withSessionRedirect } from "@/lib/api/session";

export const metadata: Metadata = {
  title: "Booking analytics",
  description: "Review campus booking demand and scheduled resource utilization.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function campusDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(now);
}

function defaultRange(): AnalyticsRange {
  const to = campusDate();
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRange(from: string, to: string): boolean {
  if (from > to) return false;
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && (end - start) / 86_400_000 < 366;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const hasRequestedRange = params.from !== undefined || params.to !== undefined;
  const fromValue = params.from;
  const toValue = params.to;
  const requestedRange: AnalyticsRange | null =
    typeof fromValue === "string" &&
    typeof toValue === "string" &&
    validDate(fromValue) &&
    validDate(toValue) &&
    validRange(fromValue, toValue)
      ? { from: fromValue, to: toValue }
      : null;
  const returnTo = requestedRange
    ? `/admin/analytics?${new URLSearchParams({ from: requestedRange.from, to: requestedRange.to }).toString()}`
    : "/admin/analytics";

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(returnTo));
  if (user.role !== "admin") redirect("/dashboard");
  if (hasRequestedRange && !requestedRange) redirect("/admin/analytics");

  const range = requestedRange ?? defaultRange();
  const summary = await withSessionRedirect(returnTo, () =>
    getAdminAnalytics(range),
  );
  return <AdminAnalytics user={user} summary={summary} />;
}
