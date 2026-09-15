"use client";

import { useState } from "react";
import type { ResourceDiscoveryFilters } from "../types";
import styles from "./resource-directory.module.css";

interface AvailabilityFilterFieldsProps {
  filters: Pick<
    ResourceDiscoveryFilters,
    "date" | "startTime" | "endTime"
  >;
}

const startTimes = Array.from({ length: 23 }, (_, hour) =>
  `${String(hour).padStart(2, "0")}:00`,
);
const endTimes = Array.from({ length: 23 }, (_, index) =>
  `${String(index + 1).padStart(2, "0")}:00`,
);

export function AvailabilityFilterFields({
  filters,
}: AvailabilityFilterFieldsProps) {
  const [date, setDate] = useState(filters.date ?? "");
  const [startTime, setStartTime] = useState(filters.startTime ?? "");
  const [endTime, setEndTime] = useState(filters.endTime ?? "");
  const intervalStarted = Boolean(date || startTime || endTime);
  const invalidOrder = Boolean(
    startTime && endTime && startTime >= endTime,
  );

  return (
    <>
      <label>
        <span>Operational date</span>
        <input
          name="date"
          type="date"
          value={date}
          required={intervalStarted}
          aria-describedby="availability-filter-hint"
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      <label>
        <span>From</span>
        <select
          name="startTime"
          value={startTime}
          required={intervalStarted}
          aria-describedby="availability-filter-hint"
          onChange={(event) => setStartTime(event.target.value)}
        >
          <option value="">Any start</option>
          {startTimes.map((time) => (
            <option value={time} key={time}>
              {time}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Until</span>
        <select
          name="endTime"
          value={endTime}
          required={intervalStarted}
          aria-invalid={invalidOrder || undefined}
          aria-describedby="availability-filter-hint"
          onChange={(event) => setEndTime(event.target.value)}
          ref={(element) => {
            element?.setCustomValidity(
              invalidOrder ? "Until must be after From." : "",
            );
          }}
        >
          <option value="">Any end</option>
          {endTimes.map((time) => (
            <option value={time} key={time}>
              {time}
            </option>
          ))}
        </select>
      </label>

      <p className={styles.availabilityHint} id="availability-filter-hint">
        Optional. If used, complete date, from, and until. Until must be after
        From. Times use ICT (UTC+7). Results exclude closures and intervals
        occupied by pending or confirmed bookings.
      </p>
    </>
  );
}
