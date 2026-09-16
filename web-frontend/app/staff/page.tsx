import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStaffBookingQueue, getStaffOperationsQueue } from "@/features/bookings/api/staff-server";
import { StaffApprovalQueue } from "@/features/bookings/components/staff-bookings";

export const metadata: Metadata = {
  title: "Staff approval queue",
  description: "Review pending campus resource booking requests.",
};

export default async function StaffDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/staff");
  if (user.role !== "staff") redirect("/dashboard");

  const [queue, operations] = await Promise.all([
    getStaffBookingQueue(),
    getStaffOperationsQueue(),
  ]);
  return <StaffApprovalQueue user={user} queue={queue} operations={operations} />;
}
