import "server-only";

import { cookies } from "next/headers";
import { getServerApiEndpoint } from "@/lib/api/server-config";
import {
  parseStaffBooking,
  parseStaffBookingQueue,
  parseStaffOperationsQueue,
  parseStaffResourceSchedule,
} from "../schema";
import type {
  StaffBooking,
  StaffBookingQueue,
  StaffOperationsQueue,
  StaffResourceSchedule,
} from "../types";

async function staffRequest(path: string, request: typeof fetch): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  try {
    return await request(getServerApiEndpoint(path), {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("The booking service is unavailable.");
  }
}

export async function getStaffOperationsQueue(
  request: typeof fetch = fetch,
): Promise<StaffOperationsQueue> {
  const response = await staffRequest("/staff/bookings/operations", request);
  if (!response.ok) throw new Error(`Operations queue lookup failed with ${response.status}.`);
  const queue = parseStaffOperationsQueue(await response.json().catch(() => null));
  if (!queue) throw new Error("The booking service returned invalid operations data.");
  return queue;
}

export async function getStaffBookingQueue(
  request: typeof fetch = fetch,
): Promise<StaffBookingQueue> {
  const response = await staffRequest("/staff/bookings/pending", request);
  if (!response.ok) throw new Error(`Approval queue lookup failed with ${response.status}.`);
  const queue = parseStaffBookingQueue(await response.json().catch(() => null));
  if (!queue) throw new Error("The booking service returned invalid queue data.");
  return queue;
}

export async function getStaffBooking(
  id: string,
  request: typeof fetch = fetch,
): Promise<StaffBooking | null> {
  const response = await staffRequest(`/staff/bookings/${id}`, request);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Booking lookup failed with ${response.status}.`);
  const booking = parseStaffBooking(await response.json().catch(() => null));
  if (!booking || booking.id !== id) {
    throw new Error("The booking service returned invalid booking data.");
  }
  return booking;
}

export async function getStaffResourceSchedule(
  resourceId: string,
  date: string,
  request: typeof fetch = fetch,
): Promise<StaffResourceSchedule> {
  const response = await staffRequest(
    `/staff/bookings/resources/${resourceId}/schedule?date=${encodeURIComponent(date)}`,
    request,
  );
  if (!response.ok) throw new Error(`Resource schedule lookup failed with ${response.status}.`);
  const schedule = parseStaffResourceSchedule(
    await response.json().catch(() => null),
    resourceId,
    date,
  );
  if (!schedule) throw new Error("The booking service returned invalid schedule data.");
  return schedule;
}
