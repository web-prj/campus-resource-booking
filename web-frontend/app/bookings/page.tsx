import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBookings } from "@/features/bookings/api/server";
import { StudentBookings } from "@/features/bookings/components/student-bookings";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Review upcoming, pending, and previous campus bookings.",
};

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/bookings");
  if (user.role !== "student") redirect("/dashboard");

  const timeline = await getStudentBookings();
  return <StudentBookings user={user} timeline={timeline} />;
}
