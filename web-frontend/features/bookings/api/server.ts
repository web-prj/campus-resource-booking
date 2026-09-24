import "server-only";

import { cookies } from "next/headers";
import { getServerApiEndpoint } from "@/lib/api/server-config";
import { assertSessionActive } from "@/lib/api/session";
import {
  parseStudentBooking,
  parseStudentBookingTimeline,
} from "../schema";
import type { StudentBooking, StudentBookingTimeline } from "../types";

async function bookingRequest(
  path: string,
  request: typeof fetch,
): Promise<{ status: number; body: unknown }> {
  const cookieHeader = (await cookies()).toString();
  let response: Response;
  try {
    response = await request(getServerApiEndpoint(path), {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("The booking service is unavailable.");
  }
  assertSessionActive(response);
  const body = await response.json().catch(() => null);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Booking lookup failed with ${response.status}.`);
  }
  return { status: response.status, body };
}

export async function getStudentBookings(
  request: typeof fetch = fetch,
): Promise<StudentBookingTimeline> {
  const response = await bookingRequest("/bookings/mine", request);
  const timeline = parseStudentBookingTimeline(response.body);
  if (!timeline) {
    throw new Error("The booking service returned invalid timeline data.");
  }
  return timeline;
}

export async function getStudentBooking(
  id: string,
  request: typeof fetch = fetch,
): Promise<StudentBooking | null> {
  const response = await bookingRequest(`/bookings/mine/${id}`, request);
  if (response.status === 404) return null;
  const booking = parseStudentBooking(response.body);
  if (!booking || booking.id !== id) {
    throw new Error("The booking service returned invalid booking data.");
  }
  return booking;
}
