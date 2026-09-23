import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import {
  getResourceAvailability,
  getResourceDetail,
} from "@/features/resources/api/server";
import { ResourceDetail } from "@/features/resources/components/resource-detail";
import { AvailabilityLiveRegion } from "@/features/resources/components/availability-live-region";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const metadata: Metadata = {
  title: "Resource details",
  description:
    "Review a USTH campus resource, its operating schedule, available time slots, location, capacity, amenities, and approval rules.",
};

interface ResourceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceDetailPage({
  params,
  searchParams,
}: ResourceDetailPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/resources/${id}`);

  const resource = await getResourceDetail(id);
  if (!resource) notFound();

  const query = await searchParams;
  const dateValue = typeof query.date === "string" ? query.date : undefined;
  const checkedDate = isCalendarDate(dateValue) ? dateValue : undefined;
  const selectedStart =
    typeof query.startTime === "string" && SLOT_PATTERN.test(query.startTime)
      ? query.startTime
      : undefined;
  const selectedEnd =
    typeof query.endTime === "string" && SLOT_PATTERN.test(query.endTime)
      ? query.endTime
      : undefined;
  const availability = checkedDate
    ? await getResourceAvailability(id, checkedDate)
    : null;
  if (checkedDate && !availability) notFound();

  const selectedSlots =
    availability && selectedStart && selectedEnd && selectedStart < selectedEnd
      ? availability.slots.filter(
          (slot) =>
            slot.startTime >= selectedStart && slot.endTime <= selectedEnd,
        )
      : [];
  const selectedRangeIsAvailable =
    selectedSlots.length > 0 &&
    selectedSlots[0].startTime === selectedStart &&
    selectedSlots.at(-1)?.endTime === selectedEnd &&
    selectedSlots.every(
      (slot, index) =>
        index === 0 || selectedSlots[index - 1].endTime === slot.startTime,
    );
  const selectedSlot =
    selectedStart && selectedEnd && selectedStart < selectedEnd
      ? selectedRangeIsAvailable
        ? { startTime: selectedStart, endTime: selectedEnd }
        : undefined
      : selectedEnd
        ? undefined
        : availability?.slots.find((slot) => slot.startTime === selectedStart);

  return (
    <ResourceDetail
      user={user}
      resource={resource}
      availability={availability}
      checkedDate={checkedDate}
      selectedSlot={selectedSlot}
      isSlotAvailable={selectedRangeIsAvailable}
      liveRegion={<AvailabilityLiveRegion key={checkedDate} resourceId={id} date={checkedDate} />}
    />
  );
}
