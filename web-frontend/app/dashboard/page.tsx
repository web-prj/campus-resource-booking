import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBookings } from "@/features/bookings/api/server";
import { StudentDashboard } from "@/features/dashboard/components/student-dashboard";
import {
  getResourceAvailability,
  getResourceDirectory,
} from "@/features/resources/api/server";

const CAMPUS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function campusDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: CAMPUS_TIME_ZONE,
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Plan your campus day and manage resource bookings.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "admin") redirect("/admin/resources");
  if (user.role === "staff") redirect("/staff");

  const date = campusDate();
  const [timeline, directory] = await Promise.all([
    getStudentBookings(),
    getResourceDirectory({}),
  ]);
  const resources = directory.page.items.slice(0, 3);
  const availability = await Promise.all(
    resources.map((resource) => getResourceAvailability(resource.id, date)),
  );
  const dashboardResources = resources.flatMap((resource, index) => {
    const resourceAvailability = availability[index];
    return resourceAvailability
      ? [{ resource, availability: resourceAvailability }]
      : [];
  });

  return (
    <StudentDashboard
      user={user}
      timeline={timeline}
      resources={dashboardResources}
      totalResources={directory.page.total}
      campusDate={date}
    />
  );
}
