import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getStaffBooking,
  getStaffResourceSchedule,
} from "@/features/bookings/api/staff-server";
import { StaffBookingDetail } from "@/features/bookings/components/staff-bookings";
import { withSessionRedirect } from "@/lib/api/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Review booking request",
  description: "Review a booking request and its resource schedule.",
};

interface StaffBookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffBookingDetailPage({
  params,
}: StaffBookingDetailPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/staff/bookings/${id}`);
  if (user.role !== "staff" && user.role !== "admin") redirect("/dashboard");

  const returnTo = `/staff/bookings/${id}`;
  const booking = await withSessionRedirect(returnTo, () => getStaffBooking(id));
  if (!booking) notFound();
  const schedule = await withSessionRedirect(returnTo, () =>
    getStaffResourceSchedule(booking.resource.id, booking.date),
  );
  return (
    <StaffBookingDetail
      key={`${booking.id}:${booking.status}:${booking.canConfirmCheckIn}:${booking.canCheckOut}:${booking.canMarkNoShow}:${booking.reviewedAt ?? "none"}`}
      user={user}
      booking={booking}
      schedule={schedule}
    />
  );
}
