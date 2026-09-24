import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStaffBookingQueue, getStaffOperationsQueue } from "@/features/bookings/api/staff-server";
import { StaffApprovalQueue } from "@/features/bookings/components/staff-bookings";
import { staffQueueHref } from "@/features/bookings/staff-query";
import { loginRedirectPath, withSessionRedirect } from "@/lib/api/session";
import { lastPageFor, parsePageParam } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Staff approval queue",
  description: "Review pending campus resource booking requests.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const pages = {
    pendingPage: parsePageParam(params.pendingPage),
    operationsPage: parsePageParam(params.operationsPage),
  };

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(staffQueueHref(pages)));
  if (user.role !== "staff" && user.role !== "admin") redirect("/dashboard");

  const [queue, operations] = await withSessionRedirect(
    staffQueueHref(pages),
    () =>
      Promise.all([
        getStaffBookingQueue(pages.pendingPage),
        getStaffOperationsQueue(pages.operationsPage),
      ]),
  );

  const clamped = {
    pendingPage: Math.min(pages.pendingPage, lastPageFor(queue.totalPages)),
    operationsPage: Math.min(
      pages.operationsPage,
      lastPageFor(operations.totalPages),
    ),
  };
  if (
    clamped.pendingPage !== pages.pendingPage ||
    clamped.operationsPage !== pages.operationsPage
  ) {
    redirect(staffQueueHref(clamped));
  }

  return <StaffApprovalQueue user={user} queue={queue} operations={operations} />;
}
