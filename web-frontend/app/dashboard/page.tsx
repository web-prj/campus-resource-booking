import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { StudentDashboard } from "@/features/dashboard/components/student-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Plan your campus day and manage resource bookings.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "admin") redirect("/admin/resources");

  return <StudentDashboard user={user} />;
}
