import Link from "next/link";
import { BookingRequestForm } from "@/features/bookings/components/booking-request-form";
import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ClockIcon,
  EquipmentIcon,
  LaboratoryIcon,
  MapPinIcon,
  PeopleIcon,
  RoomIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User } from "@/features/auth/types";
import type {
  AvailabilityBlockedReason,
  AvailabilitySlot,
  Resource,
  ResourceAvailability,
  ResourceStatus,
  ResourceType,
} from "../types";
import styles from "./resource-detail.module.css";

const typeLabels: Record<ResourceType, string> = {
  room: "Room",
  laboratory: "Laboratory",
  equipment: "Equipment",
};

const statusLabels: Record<ResourceStatus, string> = {
  active: "Active resource",
  maintenance: "Under maintenance",
  inactive: "Inactive resource",
};

const blockedMessages: Record<AvailabilityBlockedReason, string> = {
  maintenance: "This resource is under maintenance and has no available slots.",
  inactive: "This resource is inactive and has no available slots.",
  closure: "This resource is closed for the selected date.",
  closed_day: "This date is outside the resource’s operating days.",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ResourceTypeIcon({ type }: { type: ResourceType }) {
  if (type === "laboratory") return <LaboratoryIcon />;
  if (type === "equipment") return <EquipmentIcon />;
  return <RoomIcon />;
}

function scheduleDays(days: number[]): string {
  return days.map((day) => dayLabels[day]).join(", ");
}

interface ResourceDetailProps {
  user: User;
  resource: Resource;
  availability?: ResourceAvailability | null;
  checkedDate?: string;
  selectedSlot?: AvailabilitySlot;
}

export function ResourceDetail({
  user,
  resource,
  availability = null,
  checkedDate,
  selectedSlot,
}: ResourceDetailProps) {
  const statusDescription =
    resource.status === "active"
      ? "Listed in the student directory"
      : "Unavailable for operational use";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Resource navigation">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/resources" aria-current="page">
            Resources
          </Link>
          {user.role === "student" && <Link href="/bookings">My bookings</Link>}
        </nav>
        <div className={styles.identity}>
          <span>
            <strong>{user.fullName}</strong>
            <small>{user.role}</small>
          </span>
          <LogoutButton
            className={styles.logout}
            errorClassName={styles.logoutError}
          />
        </div>
      </header>

      <div className={styles.shell}>
        <Link className={styles.backLink} href="/resources">
          <ChevronLeftIcon /> Back to resource directory
        </Link>

        <section className={styles.resourceHero} aria-labelledby="resource-title">
          <div className={styles.heroIdentity}>
            <span className={styles.resourceIcon} data-type={resource.type}>
              <ResourceTypeIcon type={resource.type} />
            </span>
            <div>
              <p>
                {typeLabels[resource.type]} · {resource.code}
              </p>
              <h1 id="resource-title">{resource.name}</h1>
              <span>
                <MapPinIcon /> {resource.building.name} · {resource.location}
              </span>
            </div>
          </div>

          <div className={styles.heroStatus} data-status={resource.status}>
            <span>{statusLabels[resource.status]}</span>
            <p>{statusDescription}</p>
          </div>
        </section>

        <section
          className={styles.availabilityWorkspace}
          aria-labelledby="availability-title"
        >
          <div className={styles.availabilityHeading}>
            <span className={styles.availabilityIcon}>
              <ClockIcon />
            </span>
            <div>
              <p>Operational schedule</p>
              <h2 id="availability-title">Check availability</h2>
              <span>
                {scheduleDays(resource.operatingDays)} · {resource.opensAt}–
                {resource.closesAt} ICT (UTC+7)
              </span>
            </div>
          </div>

          <form
            key={`${checkedDate ?? "no-date"}:${selectedSlot?.startTime ?? "no-start"}:${selectedSlot?.endTime ?? "no-end"}`}
            className={styles.dateForm}
            method="get"
          >
            <label>
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={checkedDate ?? ""}
              />
            </label>
            <button type="submit">Check date</button>
          </form>

          {!availability ? (
            <div className={styles.availabilityPrompt}>
              <strong>Select a date to see hourly slots.</strong>
              <span>
                Displayed slots reflect operating schedules, full-day closures,
                and current pending, confirmed, or checked-in bookings.
              </span>
            </div>
          ) : availability.blockedReason ? (
            <div className={styles.blockedState} role="status">
              <strong>No operational availability</strong>
              <span>{blockedMessages[availability.blockedReason]}</span>
              {availability.closureReason && (
                <small>Closure reason: {availability.closureReason}</small>
              )}
            </div>
          ) : availability.slots.length === 0 ? (
            <div className={styles.blockedState} role="status">
              <strong>No bookable hourly slots remain</strong>
              <span>
                Every operational slot on this date has elapsed or is occupied
                by a pending, confirmed, or checked-in booking. Choose another date.
              </span>
            </div>
          ) : (
            <div className={styles.slotArea}>
              <div className={styles.slotSummary} role="status">
                <strong>
                  {availability.slots.length} operational hourly {availability.slots.length === 1 ? "slot" : "slots"}
                </strong>
                <span>{availability.date} · ICT (UTC+7)</span>
                <small>
                  Pending, confirmed, and checked-in bookings are excluded. Availability is
                  checked again when a booking request is sent.
                </small>
              </div>
              <div className={styles.slotGrid} aria-label="Available time slots">
                {availability.slots.map((slot) => {
                  const selected = selectedSlot?.startTime === slot.startTime;
                  const href = `/resources/${resource.id}?date=${encodeURIComponent(
                    availability.date,
                  )}&startTime=${encodeURIComponent(
                    slot.startTime,
                  )}&endTime=${encodeURIComponent(slot.endTime)}`;
                  return (
                    <Link
                      key={slot.startTime}
                      href={href}
                      aria-label={`${slot.startTime} to ${slot.endTime}`}
                      aria-current={selected ? "true" : undefined}
                    >
                      <span>{slot.startTime}</span>
                      <small>to {slot.endTime}</small>
                    </Link>
                  );
                })}
              </div>
              {selectedSlot && (
                <>
                  <p className={styles.selectionNotice} role="status">
                    <strong>
                      {selectedSlot.startTime}–{selectedSlot.endTime} selected.
                    </strong>{" "}
                    This does not reserve or hold the resource.
                  </p>
                  <BookingRequestForm
                    key={`${availability.date}:${selectedSlot.startTime}:${selectedSlot.endTime}`}
                    user={user}
                    resourceName={resource.name}
                    requiresApproval={resource.requiresApproval}
                    input={{
                      resourceId: resource.id,
                      date: availability.date,
                      startTime: selectedSlot.startTime,
                      endTime: selectedSlot.endTime,
                    }}
                  />
                </>
              )}
            </div>
          )}

          <div className={styles.availabilityPolicy}>
            <ShieldCheckIcon />
            <span>
              {resource.requiresApproval
                ? "A future booking request for this resource will require staff approval."
                : "No staff approval is required by this resource’s current policy."}{" "}
              Select a slot to review and send a booking request.
            </span>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.detailPanel} aria-labelledby="overview-title">
              <div className={styles.sectionHeading}>
                <p>Resource overview</p>
                <h2 id="overview-title">What this resource offers</h2>
              </div>
              <p className={styles.description}>
                {resource.description ||
                  "No additional description has been provided for this resource."}
              </p>

              <dl className={styles.facts}>
                <div>
                  <dt>
                    <PeopleIcon /> Capacity
                  </dt>
                  <dd>
                    {resource.capacity} {resource.capacity === 1 ? "place" : "places"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <ShieldCheckIcon /> Approval policy
                  </dt>
                  <dd>
                    {resource.requiresApproval
                      ? "Staff approval required"
                      : "No staff approval required"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <MapPinIcon /> Building
                  </dt>
                  <dd>{resource.building.name}</dd>
                </div>
                <div>
                  <dt>Campus location</dt>
                  <dd>{resource.location}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.amenityPanel} aria-labelledby="amenities-title">
              <div className={styles.sectionHeading}>
                <p>Room setup and equipment</p>
                <h2 id="amenities-title">Amenities</h2>
              </div>
              {resource.amenities.length ? (
                <ul>
                  {resource.amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyAmenities}>
                  No additional amenities are listed. Check the resource details
                  with campus staff if you need specific equipment.
                </p>
              )}
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.locationPanel} aria-labelledby="location-title">
              <span className={styles.locationIcon}>
                <MapPinIcon />
              </span>
              <div>
                <p>Campus location</p>
                <h2 id="location-title">{resource.building.code}</h2>
                <strong>{resource.building.name}</strong>
                <span>{resource.building.address}</span>
                <small>{resource.location}</small>
              </div>
            </section>

            <section className={styles.comparePanel} aria-labelledby="compare-title">
              <div>
                <p>Need another option?</p>
                <h2 id="compare-title">Compare campus resources</h2>
                <span>Return to the directory to filter by date, time, capacity, and equipment.</span>
              </div>
              <Link href="/resources">
                Compare other resources <ArrowRightIcon />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
