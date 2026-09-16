import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getStudentBooking } from "@/features/bookings/api/server";
import { StudentBookingDetail } from "@/features/bookings/components/student-bookings";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Booking details",
  description: "Review a campus booking and cancel it when eligible.",
};

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);
  if (user.role !== "student") redirect("/dashboard");

  const booking = await getStudentBooking(id);
  if (!booking) notFound();
  return <StudentBookingDetail user={user} booking={booking} />;
}
