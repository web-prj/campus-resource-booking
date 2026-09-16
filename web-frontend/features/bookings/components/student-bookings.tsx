"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  EquipmentIcon,
  LaboratoryIcon,
  MapPinIcon,
  RoomIcon,
  ShieldCheckIcon,
  StatusIcon,
} from "@/components/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User } from "@/features/auth/types";
import { BookingRequestError, cancelStudentBooking, requestStudentCheckIn } from "../api/browser";
import type {
  BookingStatus,
  StudentBooking,
  StudentBookingTimeline,
} from "../types";
import styles from "./student-bookings.module.css";

const statusLabels: Record<BookingStatus, string> = {
  pending: "Pending approval",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function ResourceIcon({ type }: { type: StudentBooking["resource"]["type"] }) {
  if (type === "laboratory") return <LaboratoryIcon />;
  if (type === "equipment") return <EquipmentIcon />;
  return <RoomIcon />;
}

function dateParts(date: string): { day: string; month: string; full: string } {
  const value = new Date(`${date}T00:00:00+07:00`);
  return {
    day: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
    full: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
  };
}

function BookingRow({ booking }: { booking: StudentBooking }) {
  const date = dateParts(booking.date);
  return (
    <article className={styles.bookingRow} data-status={booking.status}>
      <time className={styles.dateBlock} dateTime={booking.date}>
        <strong>{date.day}</strong>
        <span>{date.month}</span>
      </time>
      <span className={styles.resourceIcon} data-type={booking.resource.type}>
        <ResourceIcon type={booking.resource.type} />
      </span>
      <div className={styles.bookingIdentity}>
        <span className={styles.status} data-status={booking.status}>
          {statusLabels[booking.status]}
        </span>
        <h3>{booking.resource.name}</h3>
        <p>
          <ClockIcon /> {booking.startTime}–{booking.endTime} ICT
          <span aria-hidden="true">·</span>
          <MapPinIcon /> {booking.resource.buildingCode} · {booking.resource.location}
        </p>
      </div>
      <Link className={styles.detailLink} href={`/bookings/${booking.id}`}>
        View details <ArrowRightIcon />
      </Link>
    </article>
  );
}

interface StudentBookingsProps {
  user: User;
  timeline: StudentBookingTimeline;
}

export function StudentBookings({ user, timeline }: StudentBookingsProps) {
  const pending = timeline.upcoming.filter(
    (booking) => booking.status === "pending",
  );
  const confirmed = timeline.upcoming.filter(
    (booking) => booking.status === "confirmed",
  );
  const next = timeline.upcoming[0];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Booking navigation">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/bookings" aria-current="page">My bookings</Link>
        </nav>
        <div className={styles.identity}>
          <span><strong>{user.fullName}</strong><small>Student</small></span>
          <LogoutButton className={styles.logout} errorClassName={styles.logoutError} />
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="bookings-title">
          <div>
            <p>Student booking ledger</p>
            <h1 id="bookings-title">Your campus reservations.</h1>
            <span>Track requests, prepare for confirmed visits, and review past activity.</span>
          </div>
          <Link href="/resources">Find another resource <ArrowRightIcon /></Link>
        </section>

        <section className={styles.nextPanel} aria-labelledby="next-booking-title">
          <div className={styles.nextCopy}>
            <p><CalendarIcon /> Next booking</p>
            {next ? (
              <>
                <span className={styles.nextStatus} data-status={next.status}>
                  {statusLabels[next.status]}
                </span>
                <h2 id="next-booking-title">{next.resource.name}</h2>
                <strong>{dateParts(next.date).full}</strong>
                <span>{next.startTime}–{next.endTime} ICT · {next.resource.buildingName}</span>
                <Link href={`/bookings/${next.id}`}>Open booking <ArrowRightIcon /></Link>
              </>
            ) : (
              <>
                <h2 id="next-booking-title">No upcoming bookings</h2>
                <span>Your next confirmed or pending reservation will appear here.</span>
                <Link href="/resources">Explore availability <ArrowRightIcon /></Link>
              </>
            )}
          </div>
          <div className={styles.nextMarker} aria-hidden="true">
            <span>{next ? dateParts(next.date).day : "—"}</span>
            <small>{next ? dateParts(next.date).month : "Open"}</small>
          </div>
        </section>

        <section className={styles.summary} aria-label="Booking summary">
          <div><ShieldCheckIcon /><strong>{confirmed.length}</strong><span>Confirmed upcoming</span></div>
          <div><ClockIcon /><strong>{pending.length}</strong><span>Awaiting approval</span></div>
          <div><StatusIcon /><strong>{timeline.history.length}</strong><span>History entries</span></div>
        </section>

        <div className={styles.ledger}>
          <section aria-labelledby="upcoming-title">
            <div className={styles.sectionHeading}>
              <div><p>Active reservations</p><h2 id="upcoming-title">Upcoming and pending</h2></div>
              <span>{timeline.upcoming.length}</span>
            </div>
            {timeline.upcoming.length ? (
              <div className={styles.bookingList}>
                {timeline.upcoming.map((booking) => <BookingRow booking={booking} key={booking.id} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <CalendarIcon />
                <div><h3>No active reservations</h3><p>Search the directory by date and time to reserve a campus resource.</p></div>
                <Link href="/resources">Browse resources</Link>
              </div>
            )}
          </section>

          <section aria-labelledby="history-title">
            <div className={styles.sectionHeading}>
              <div><p>Booking record</p><h2 id="history-title">History</h2></div>
              <span>{timeline.history.length}</span>
            </div>
            {timeline.history.length ? (
              <div className={styles.bookingList}>
                {timeline.history.map((booking) => <BookingRow booking={booking} key={booking.id} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <StatusIcon />
                <div><h3>No booking history yet</h3><p>Past and cancelled bookings will remain here for reference.</p></div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

interface StudentBookingDetailProps {
  user: User;
  booking: StudentBooking;
}

export function StudentBookingDetail({ user, booking: initialBooking }: StudentBookingDetailProps) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);
  const [confirming, setConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState("");
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const keepBookingRef = useRef<HTMLButtonElement>(null);
  const actionHeadingRef = useRef<HTMLHeadingElement>(null);
  const date = dateParts(booking.date);

  useEffect(() => {
    if (confirming) keepBookingRef.current?.focus();
  }, [confirming]);

  function keepBooking() {
    setConfirming(false);
    requestAnimationFrame(() => cancelButtonRef.current?.focus());
  }

  async function requestCheckIn() {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    setError("");
    try {
      setBooking(await requestStudentCheckIn(booking.id));
      requestAnimationFrame(() => actionHeadingRef.current?.focus());
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof BookingRequestError
          ? caught.message
          : "A check-in code could not be generated. Try again.",
      );
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function cancel() {
    if (isCancelling) return;
    setIsCancelling(true);
    setError("");
    try {
      setBooking(await cancelStudentBooking(booking.id));
      setConfirming(false);
      requestAnimationFrame(() => actionHeadingRef.current?.focus());
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof BookingRequestError
          ? caught.message
          : "This booking could not be cancelled. Try again.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Booking navigation">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/bookings" aria-current="page">My bookings</Link>
        </nav>
        <div className={styles.identity}>
          <span><strong>{user.fullName}</strong><small>Student</small></span>
          <LogoutButton className={styles.logout} errorClassName={styles.logoutError} />
        </div>
      </header>

      <div className={styles.detailShell}>
        <Link className={styles.backLink} href="/bookings">← Back to my bookings</Link>
        <section className={styles.detailHero} aria-labelledby="booking-title">
          <div>
            <span className={styles.status} data-status={booking.status}>{statusLabels[booking.status]}</span>
            <p>{booking.resource.code} · Booking reference {booking.id.slice(0, 8).toUpperCase()}</p>
            <h1 id="booking-title">{booking.resource.name}</h1>
            <span>{booking.resource.buildingName} · {booking.resource.location}</span>
          </div>
          <time dateTime={booking.date}><strong>{date.day}</strong><span>{date.month}</span></time>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.detailPanel} aria-labelledby="schedule-title">
            <div className={styles.detailHeading}><ClockIcon /><div><p>Booking schedule</p><h2 id="schedule-title">{date.full}</h2></div></div>
            <dl className={styles.detailFacts}>
              <div><dt>Time</dt><dd>{booking.startTime}–{booking.endTime} ICT (UTC+7)</dd></div>
              <div><dt>Status</dt><dd>{statusLabels[booking.status]}</dd></div>
              <div><dt>Resource type</dt><dd>{booking.resource.type}</dd></div>
              <div><dt>Building</dt><dd>{booking.resource.buildingCode} · {booking.resource.buildingName}</dd></div>
              <div><dt>Location</dt><dd>{booking.resource.location}</dd></div>
              <div><dt>Requested</dt><dd>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(booking.createdAt))}</dd></div>
            </dl>
          </section>

          <aside className={styles.actionPanel} aria-labelledby="action-title">
            <ShieldCheckIcon />
            <h2 ref={actionHeadingRef} tabIndex={-1} id="action-title">
              {booking.status === "pending"
                ? "Waiting for staff approval"
                : booking.status === "confirmed"
                  ? booking.checkInCode
                    ? "Show this code to campus staff"
                    : booking.canRequestCheckIn
                      ? "You can check in now"
                      : "Your booking is confirmed"
                  : booking.status === "checked_in"
                    ? "You are checked in"
                    : booking.status === "completed"
                      ? "Visit completed"
                      : booking.status === "no_show"
                        ? "Recorded as no-show"
                        : booking.status === "rejected"
                          ? "This request was not approved"
                          : "This booking was cancelled"}
            </h2>
            <p>
              {booking.status === "pending"
                ? "The interval is protected while staff review the request."
                : booking.status === "confirmed"
                  ? booking.checkInCode
                    ? "Staff will enter this one-time code to confirm your arrival."
                    : booking.canRequestCheckIn
                      ? "Generate your one-time code and present it to staff at the resource."
                      : "Check-in opens 15 minutes before the booking starts."
                  : booking.status === "checked_in"
                    ? "Staff confirmed your arrival. Check out before leaving the resource."
                    : booking.status === "completed"
                      ? `Checked out ${booking.checkedOutAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(booking.checkedOutAt)) : ""}.`
                      : booking.status === "no_show"
                        ? "Staff recorded that this booking was not used."
                        : booking.status === "rejected"
                          ? booking.rejectionReason ?? "Staff could not approve this request."
                          : `Cancelled ${booking.cancelledAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(booking.cancelledAt)) : ""}. The interval is available for others again.`}
            </p>
            {booking.status === "confirmed" && booking.checkInCode && (
              <div className={styles.checkInCode} role="status" aria-label={`Check-in code ${booking.checkInCode}`}>
                <span>Check-in code</span>
                <strong>{booking.checkInCode}</strong>
                <small>Use once · Do not share outside campus staff</small>
              </div>
            )}
            {booking.canRequestCheckIn && !booking.checkInCode && (
              <button className={styles.checkInButton} type="button" disabled={isCheckingIn} onClick={() => void requestCheckIn()}>
                {isCheckingIn ? "Generating code…" : "Generate check-in code"}
              </button>
            )}
            {booking.canCancel && !confirming && (
              <button ref={cancelButtonRef} className={styles.cancelButton} type="button" onClick={() => setConfirming(true)}>Cancel booking</button>
            )}
            {booking.canCancel && confirming && (
              <div className={styles.confirmCancel} role="group" aria-label="Confirm booking cancellation">
                <strong>Release this time slot?</strong>
                <span>This cannot be undone.</span>
                <div>
                  <button ref={keepBookingRef} type="button" disabled={isCancelling} onClick={keepBooking}>Keep booking</button>
                  <button type="button" disabled={isCancelling} onClick={() => void cancel()}>{isCancelling ? "Cancelling…" : "Yes, cancel"}</button>
                </div>
              </div>
            )}
            {error && <p className={styles.actionError} role="alert">{error}</p>}
            <Link href={`/resources/${booking.resource.id}`}>View resource details <ArrowRightIcon /></Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
