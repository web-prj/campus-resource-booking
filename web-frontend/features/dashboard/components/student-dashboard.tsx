import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EquipmentIcon,
  GridIcon,
  LaboratoryIcon,
  MapPinIcon,
  RoomIcon,
  SearchIcon,
  StatusIcon,
} from "@/components/icons";
import type { User } from "@/features/auth/types";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { StudentBooking, StudentBookingTimeline } from "@/features/bookings/types";
import type {
  Resource,
  ResourceAvailability,
  ResourceType,
} from "@/features/resources/types";
import styles from "./student-dashboard.module.css";

const availabilityBands = [
  { startTime: "08:00", endTime: "10:00" },
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "12:00", endTime: "14:00" },
  { startTime: "14:00", endTime: "16:00" },
  { startTime: "16:00", endTime: "18:00" },
  { startTime: "18:00", endTime: "20:00" },
] as const;

const bookingStatusLabels: Record<StudentBooking["status"], string> = {
  pending: "Pending approval",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const resourceTypeLabels: Record<ResourceType, string> = {
  room: "Room",
  laboratory: "Laboratory",
  equipment: "Equipment",
};

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatCampusDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function formatBookingDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function availabilityState(
  availability: ResourceAvailability,
  startTime: string,
): "open" | "partial" | "unavailable" {
  if (availability.blockedReason) return "unavailable";
  const startHour = Number(startTime.slice(0, 2));
  const expectedStarts = [startHour, startHour + 1].map(
    (hour) => `${String(hour).padStart(2, "0")}:00`,
  );
  const availableHours = expectedStarts.filter((hour) =>
    availability.slots.some((slot) => slot.startTime === hour),
  ).length;
  return availableHours === 2
    ? "open"
    : availableHours === 1
      ? "partial"
      : "unavailable";
}

function ResourceIcon({ type }: { type: ResourceType }) {
  const Icon =
    type === "room"
      ? RoomIcon
      : type === "laboratory"
        ? LaboratoryIcon
        : EquipmentIcon;
  return <Icon />;
}

export interface DashboardResource {
  resource: Resource;
  availability: ResourceAvailability;
}

interface StudentDashboardProps {
  user: User;
  timeline: StudentBookingTimeline;
  resources: DashboardResource[];
  totalResources: number;
  campusDate: string;
  liveRegion?: ReactNode;
}

export function StudentDashboard({
  user,
  timeline,
  resources,
  totalResources,
  campusDate,
  liveRegion,
}: StudentDashboardProps) {
  const initials = getInitials(user.fullName);
  const nextBooking = timeline.upcoming[0];

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark inverse />
        </div>

        <nav className={styles.navigation} aria-label="Dashboard navigation">
          <a
            className={styles.activeNavItem}
            href="#overview"
            aria-current="page"
          >
            <GridIcon />
            <span>Overview</span>
          </a>
          <Link className={styles.navItem} href="/resources">
            <SearchIcon />
            <span>Resources</span>
          </Link>
          <Link className={styles.navItem} href="/bookings">
            <StatusIcon />
            <span>My bookings</span>
          </Link>
        </nav>

        <div className={styles.sidebarMessage}>
          <span>
            <ClockIcon />
          </span>
          <p>
            <strong>Plan before you walk over</strong>
            Search by time and building before choosing a resource.
          </p>
        </div>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
          <span className={styles.profileCopy}>
            <strong>{user.fullName}</strong>
            <small>{user.role}</small>
          </span>
          <LogoutButton
            className={styles.logoutButton}
            errorClassName={styles.logoutError}
          />
        </div>
      </aside>

      <section className={styles.workspace} id="overview">
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <BrandMark />
          </div>
          <p className={styles.date}>
            <CalendarIcon /> {formatCampusDate(campusDate)}
          </p>
          <div className={styles.topbarProfile}>
            <span className={styles.avatar} aria-hidden="true">
              {initials}
            </span>
            <span>
              <strong>{user.fullName}</strong>
              <small>{user.role}</small>
            </span>
            <LogoutButton
              className={styles.mobileLogoutButton}
              errorClassName={styles.mobileLogoutError}
            />
          </div>
        </header>

        <div className={styles.content}>
          <section className={styles.intro} aria-labelledby="dashboard-title">
            <div>
              <p className={styles.context}>Student workspace</p>
              <h1 id="dashboard-title">Good to see you, {user.fullName}.</h1>
              <p>
                Choose a time first, then compare the campus resources that fit.
              </p>
            </div>
            <Link className={styles.primaryAction} href="/resources">
              <SearchIcon /> Explore resources
            </Link>
          </section>

          <section
            className={styles.dayboard}
            id="availability"
            aria-labelledby="availability-title"
          >
            <div className={styles.dayboardHeader}>
              <div>
                <p className={styles.sectionLabel}>Today&apos;s availability</p>
                <h2 id="availability-title">Build your campus day</h2>
              </div>
              <span className={styles.availabilityBadge}>
                {resources.length} shown · {totalResources} active resources
              </span>
            </div>
            
            {liveRegion}

            {resources.length ? (
              <div
                className={styles.schedule}
                role="group"
                aria-label={`Resource availability for ${formatCampusDate(campusDate)}`}
              >
                <div className={styles.timeScale} aria-hidden="true">
                  <span />
                  {availabilityBands.map((band) => (
                    <time key={band.startTime}>{band.startTime}</time>
                  ))}
                </div>
                {resources.map(({ resource, availability }) => (
                  <div className={styles.scheduleRow} key={resource.id}>
                    <div className={styles.resourceIdentity}>
                      <strong>{resource.name}</strong>
                      <small>
                        {resource.building.code} · Capacity {resource.capacity}
                      </small>
                    </div>
                    <div className={styles.slots}>
                      {availabilityBands.map((band) => {
                        const state = availabilityState(
                          availability,
                          band.startTime,
                        );
                        return (
                          <span
                            className={
                              state === "open"
                                ? styles.openSlot
                                : state === "partial"
                                  ? styles.partialSlot
                                  : styles.unavailableSlot
                            }
                            key={`${resource.id}-${band.startTime}`}
                            role="img"
                            aria-label={`${resource.name}, ${band.startTime} to ${band.endTime}, ${state === "open" ? "open" : state === "partial" ? "partly open" : "unavailable"}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noAvailability}>
                <ClockIcon />
                <p>
                  <strong>No resources are available to compare.</strong>
                  Check the directory for operational updates.
                </p>
              </div>
            )}

            <div className={styles.dayboardFooter}>
              <p>
                Availability reflects bookable hourly slots remaining today in
                campus time.
              </p>
              <div className={styles.legend} aria-label="Availability legend">
                <span>
                  <i className={styles.openSwatch} /> Open
                </span>
                <span>
                  <i className={styles.partialSwatch} /> Partly open
                </span>
                <span>
                  <i className={styles.unavailableSwatch} /> Unavailable
                </span>
              </div>
            </div>
          </section>

          <div className={styles.dashboardGrid}>
            <div className={styles.mainColumn}>
              <section
                className={styles.bookingPanel}
                id="bookings"
                aria-labelledby="bookings-title"
              >
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>My bookings</p>
                    <h2 id="bookings-title">Current or next booking</h2>
                  </div>
                  <span className={styles.connectionStatus}>
                    {timeline.upcoming.length} active
                  </span>
                </div>
                {nextBooking ? (
                  <article className={styles.nextBooking}>
                    <span className={styles.emptyBookingIcon}>
                      <CalendarIcon />
                    </span>
                    <div>
                      <span
                        className={styles.bookingStatus}
                        data-status={nextBooking.status}
                      >
                        {bookingStatusLabels[nextBooking.status]}
                      </span>
                      <h3>{nextBooking.resource.name}</h3>
                      <p>
                        {formatBookingDate(nextBooking.date)} · {nextBooking.startTime}–
                        {nextBooking.endTime} ICT
                        <br />
                        {nextBooking.resource.buildingCode} · {nextBooking.resource.location}
                      </p>
                    </div>
                    <Link href={`/bookings/${nextBooking.id}`}>
                      Open booking <ArrowRightIcon />
                    </Link>
                  </article>
                ) : (
                  <div className={styles.emptyBooking}>
                    <span className={styles.emptyBookingIcon}>
                      <CalendarIcon />
                    </span>
                    <div>
                      <h3>No active reservations</h3>
                      <p>
                        Choose an open time above or search the full directory
                        to reserve a campus resource.
                      </p>
                    </div>
                    <Link href="/resources">
                      Find a resource <ArrowRightIcon />
                    </Link>
                  </div>
                )}
              </section>

              <section
                className={styles.journeyPanel}
                aria-labelledby="journey-title"
              >
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>Booking path</p>
                    <h2 id="journey-title">Know what happens next</h2>
                  </div>
                </div>
                <ol className={styles.journey}>
                  <li>
                    <span>
                      <SearchIcon />
                    </span>
                    <p>
                      <strong>Find a fit</strong>
                      <small>
                        Filter by date, capacity, building, and equipment.
                      </small>
                    </p>
                  </li>
                  <li>
                    <span>
                      <ClockIcon />
                    </span>
                    <p>
                      <strong>Track approval</strong>
                      <small>
                        Some laboratories and equipment need staff review.
                      </small>
                    </p>
                  </li>
                  <li>
                    <span>
                      <CheckIcon />
                    </span>
                    <p>
                      <strong>Check in</strong>
                      <small>
                        Confirmed bookings will show the check-in method here.
                      </small>
                    </p>
                  </li>
                </ol>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section
                className={styles.resourcesPanel}
                id="resource-preview"
                aria-labelledby="resources-title"
              >
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>Resource directory</p>
                    <h2 id="resources-title">What can I book?</h2>
                  </div>
                </div>
                <p className={styles.panelIntro}>
                  {totalResources} active campus resources are currently listed.
                </p>
                {resources.length ? (
                  <div className={styles.resourceList}>
                    {resources.map(({ resource }) => (
                      <Link
                        className={styles.resourceType}
                        href={`/resources/${resource.id}`}
                        key={resource.id}
                      >
                        <span
                          className={
                            resource.type === "laboratory"
                              ? styles.redResourceIcon
                              : styles.resourceIcon
                          }
                        >
                          <ResourceIcon type={resource.type} />
                        </span>
                        <p>
                          <strong>{resource.name}</strong>
                          <small>
                            {resourceTypeLabels[resource.type]} · {resource.building.code} · Capacity {resource.capacity}
                          </small>
                        </p>
                        <ArrowRightIcon />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.resourceEmpty}>
                    No active resources are listed right now.
                  </p>
                )}
                <Link className={styles.directoryLink} href="/resources">
                  View all resources <ArrowRightIcon />
                </Link>
              </section>

              <section
                className={styles.rulesPanel}
                aria-labelledby="rules-title"
              >
                <span className={styles.rulesIcon}>
                  <MapPinIcon />
                </span>
                <div>
                  <p className={styles.sectionLabel}>Before you reserve</p>
                  <h2 id="rules-title">Campus booking essentials</h2>
                  <ul>
                    <li>Choose a slot that covers your full use time.</li>
                    <li>Check approval requirements before submitting.</li>
                    <li>Arrive ready to check in at the resource location.</li>
                  </ul>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
