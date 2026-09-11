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
import styles from "./student-dashboard.module.css";

const previewResources = [
  {
    name: "Study rooms",
    detail: "Capacity, building, and time filters",
    icon: RoomIcon,
    tone: "blue",
  },
  {
    name: "Laboratories",
    detail: "Equipment and approval requirements",
    icon: LaboratoryIcon,
    tone: "red",
  },
  {
    name: "Equipment",
    detail: "Portable kits and collection points",
    icon: EquipmentIcon,
    tone: "blue",
  },
] as const;

const previewSchedule = [
  { name: "Study room A101", location: "Building A · 8 seats", busy: [false, true, true, false, false, true] },
  { name: "Biology lab B204", location: "Building B · approval", busy: [true, true, false, false, true, true] },
  { name: "Projector kit P-12", location: "Equipment desk", busy: [false, false, false, true, true, false] },
] as const;

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function getCampusDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

interface StudentDashboardProps {
  user: User;
}

export function StudentDashboard({ user }: StudentDashboardProps) {
  const initials = getInitials(user.fullName);

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="Campus Resource Booking home">
          <BrandMark inverse />
        </Link>

        <nav className={styles.navigation} aria-label="Dashboard navigation">
          <a className={styles.activeNavItem} href="#overview" aria-current="page">
            <GridIcon />
            <span>Overview</span>
          </a>
          <a className={styles.navItem} href="#availability">
            <CalendarIcon />
            <span>Availability</span>
          </a>
          <a className={styles.navItem} href="#bookings">
            <StatusIcon />
            <span>My bookings</span>
          </a>
        </nav>

        <div className={styles.sidebarMessage}>
          <span><ClockIcon /></span>
          <p>
            <strong>Plan before you walk over</strong>
            Search by time and building before choosing a resource.
          </p>
        </div>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
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
          <p className={styles.date}><CalendarIcon /> {getCampusDate()}</p>
          <div className={styles.topbarProfile}>
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
            <span><strong>{user.fullName}</strong><small>{user.role}</small></span>
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
              <p>Choose a time first, then compare the campus resources that fit.</p>
            </div>
            <a className={styles.primaryAction} href="#resource-preview">
              <SearchIcon /> Explore resources
            </a>
          </section>

          <section className={styles.dayboard} id="availability" aria-labelledby="availability-title">
            <div className={styles.dayboardHeader}>
              <div>
                <p className={styles.sectionLabel}>Today&apos;s availability</p>
                <h2 id="availability-title">Build your campus day</h2>
              </div>
              <span className={styles.previewBadge}>Interface preview</span>
            </div>

            <div className={styles.schedule} role="group" aria-label="Preview of the resource availability timeline">
              <div className={styles.timeScale} aria-hidden="true">
                <span />
                {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((time) => <time key={time}>{time}</time>)}
              </div>
              {previewSchedule.map((resource) => (
                <div className={styles.scheduleRow} key={resource.name}>
                  <div className={styles.resourceIdentity}>
                    <strong>{resource.name}</strong>
                    <small>{resource.location}</small>
                  </div>
                  <div className={styles.slots}>
                    {resource.busy.map((busy, index) => (
                      <span
                        className={busy ? styles.busySlot : styles.openSlot}
                        key={`${resource.name}-${index}`}
                        role="img"
                        aria-label={`${resource.name}, ${8 + index * 2}:00 to ${10 + index * 2}:00, ${busy ? "booked" : "open"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.dayboardFooter}>
              <p>This sample timeline demonstrates how connected availability will be compared.</p>
              <div className={styles.legend} aria-label="Availability legend">
                <span><i className={styles.openSwatch} /> Open</span>
                <span><i className={styles.busySwatch} /> Booked</span>
              </div>
            </div>
          </section>

          <div className={styles.dashboardGrid}>
            <div className={styles.mainColumn}>
              <section className={styles.bookingPanel} id="bookings" aria-labelledby="bookings-title">
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>My bookings</p>
                    <h2 id="bookings-title">Your next reservation</h2>
                  </div>
                  <span className={styles.connectionStatus}>API connection pending</span>
                </div>
                <div className={styles.emptyBooking}>
                  <span className={styles.emptyBookingIcon}><CalendarIcon /></span>
                  <div>
                    <h3>No booking data is connected yet</h3>
                    <p>Once booking services are available, your next reservation, approval status, and check-in action will appear here.</p>
                  </div>
                  <a href="#resource-preview">Browse the preview <ArrowRightIcon /></a>
                </div>
              </section>

              <section className={styles.journeyPanel} aria-labelledby="journey-title">
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>Booking path</p>
                    <h2 id="journey-title">Know what happens next</h2>
                  </div>
                </div>
                <ol className={styles.journey}>
                  <li><span><SearchIcon /></span><p><strong>Find a fit</strong><small>Filter by date, capacity, building, and equipment.</small></p></li>
                  <li><span><ClockIcon /></span><p><strong>Track approval</strong><small>Some laboratories and equipment need staff review.</small></p></li>
                  <li><span><CheckIcon /></span><p><strong>Check in</strong><small>Confirmed bookings will show the check-in method here.</small></p></li>
                </ol>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={styles.resourcesPanel} id="resource-preview" aria-labelledby="resources-title">
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.sectionLabel}>Resource directory</p>
                    <h2 id="resources-title">What can I book?</h2>
                  </div>
                </div>
                <p className={styles.panelIntro}>Preview the search categories planned for the resource catalogue.</p>
                <div className={styles.resourceList}>
                  {previewResources.map(({ name, detail, icon: Icon, tone }) => (
                    <div className={styles.resourceType} key={name}>
                      <span className={tone === "red" ? styles.redResourceIcon : styles.resourceIcon}><Icon /></span>
                      <p><strong>{name}</strong><small>{detail}</small></p>
                      <ArrowRightIcon />
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.rulesPanel} aria-labelledby="rules-title">
                <span className={styles.rulesIcon}><MapPinIcon /></span>
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
