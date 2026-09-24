import type { AvailabilitySlot, ResourceAvailability } from "./types";

export interface SlotSelection {
  /** The interval named by the URL, when it is complete and well formed. */
  selectedSlot: AvailabilitySlot | undefined;
  /** Whether every hour of the selected interval is still bookable. */
  isSlotAvailable: boolean;
}

const NO_SELECTION: SlotSelection = {
  selectedSlot: undefined,
  isSlotAvailable: false,
};

/**
 * Resolves the start/end query values against authoritative availability.
 *
 * - A start time without an end time selects the single hourly slot that
 *   starts then, but only while that slot is still available.
 * - A complete range inside operating hours is always returned so the page
 *   can explain when it is no longer available (for example, after another
 *   student booked it or a realtime refresh removed it).
 * - Anything incomplete, reversed, or outside operating hours selects nothing.
 */
export function resolveSlotSelection(
  availability: ResourceAvailability,
  startTime: string | undefined,
  endTime: string | undefined,
): SlotSelection {
  if (!startTime) return NO_SELECTION;

  if (!endTime) {
    const slot = availability.slots.find((item) => item.startTime === startTime);
    return slot
      ? { selectedSlot: { ...slot }, isSlotAvailable: true }
      : NO_SELECTION;
  }

  if (
    startTime >= endTime ||
    startTime < availability.opensAt ||
    endTime > availability.closesAt
  ) {
    return NO_SELECTION;
  }

  const covered = availability.slots.filter(
    (slot) => slot.startTime >= startTime && slot.endTime <= endTime,
  );
  const isSlotAvailable =
    covered.length > 0 &&
    covered[0].startTime === startTime &&
    covered.at(-1)?.endTime === endTime &&
    covered.every(
      (slot, index) => index === 0 || covered[index - 1].endTime === slot.startTime,
    );

  return { selectedSlot: { startTime, endTime }, isSlotAvailable };
}
