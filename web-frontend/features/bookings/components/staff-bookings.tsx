"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSafeRedirect } from "@/features/auth/routing";
import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StatusIcon,
} from "@/components/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User } from "@/features/auth/types";
import {
  approveStaffBooking,
  checkOutStaffBooking,
  confirmStaffCheckIn,
  markStaffBookingNoShow,
  rejectStaffBooking,
  StaffBookingActionError,
} from "../api/staff-browser";
import type {
  StaffBooking,
  StaffBookingQueue,
  StaffOperationsQueue,
  StaffResourceSchedule,
} from "../types";
import styles from "./staff-bookings.module.css";

const statusLabels: Record<StaffBooking["status"], string> = {
  pending: "Pending review",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function requestedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function StaffHeader({ user, detail = false }: { user: User; detail?: boolean }) {
  return (
    <header className={styles.header}>
      <BrandMark href="/staff" />
      <nav className={styles.headerNav} aria-label="Staff navigation">
        <Link prefetch={false} href="/staff" aria-current={detail ? undefined : "page"}>Approval queue</Link>
        {detail && <span aria-current="page">Request detail</span>}
      </nav>
      <div className={styles.identity}>
        <span><strong>{user.fullName}</strong><small>Staff</small></span>
        <LogoutButton className={styles.logout} errorClassName={styles.logoutError} />
      </div>
    </header>
  );
}

export function StaffApprovalQueue({
  user,
  queue,
  operations,
}: {
  user: User;
  queue: StaffBookingQueue;
  operations: StaffOperationsQueue;
}) {
  const codeReady = operations.items.filter(
    (booking) => booking.canConfirmCheckIn,
  ).length;
  const activeVisits = operations.items.filter(
    (booking) => booking.canCheckOut,
  ).length;
  const oldest = queue.items[0];
  const today = operations.campusDate;

  return (
    <main className={styles.page}>
      <StaffHeader user={user} />
      <div className={styles.shell}>
        <section className={styles.queueHero} aria-labelledby="queue-title">
          <div>
            <p>Staff operations · Approval desk</p>
            <h1 id="queue-title">Booking requests awaiting a decision.</h1>
            <span>Review oldest requests first, check the resource schedule, and record a clear outcome.</span>
          </div>
          <div className={styles.queueCount} aria-label={`${queue.total} pending requests`}>
            <strong>{queue.total}</strong><span>Pending</span>
          </div>
        </section>

        <section className={styles.summary} aria-label="Staff dashboard summary">
          <div><StatusIcon /><strong>{queue.total}</strong><span>Requests to review</span></div>
          <div><CalendarIcon /><strong>{operations.total}</strong><span>Open visits to manage</span></div>
          <div><ShieldCheckIcon /><strong>{codeReady}</strong><span>Codes ready to verify</span></div>
          <div><ClockIcon /><strong>{activeVisits}</strong><span>Active visits</span></div>
          <div><ClockIcon /><strong>{oldest ? requestedAt(oldest.createdAt) : "—"}</strong><span>Oldest request</span></div>
        </section>

        <section className={styles.queueSection} aria-labelledby="operations-title">
          <div className={styles.sectionHeading}>
            <div><p>Operational worklist</p><h2 id="operations-title">Arrivals and unresolved visits</h2></div>
            <span>{operations.total}</span>
          </div>
          {operations.items.length ? (
            <div className={styles.operationsGrid}>
              {operations.items.map((booking) => (
                <article className={styles.operationCard} key={booking.id}>
                  <span className={styles.status} data-status={booking.status}>{statusLabels[booking.status]}</span>
                  <time dateTime={`${booking.date}T${booking.startTime}:00+07:00`}>
                    {booking.date < today ? `Overdue · ${shortDate(booking.date)}` : "Today"} · {booking.startTime}–{booking.endTime} ICT
                  </time>
                  <h3>{booking.resource.name}</h3>
                  <p>{booking.requester.fullName} · {booking.resource.location}</p>
                  <strong>{booking.canCheckOut ? "Ready for checkout" : booking.canMarkNoShow ? "Ready for no-show review" : booking.canConfirmCheckIn ? "Code ready for staff" : booking.checkInRequested ? "Code generated · check-in unavailable" : "Awaiting student check-in"}</strong>
                  <Link prefetch={false} href={`/staff/bookings/${booking.id}`}>Open visit <ArrowRightIcon /></Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <ClockIcon />
              <div><h3>No visits need attention</h3><p>Today&apos;s confirmed bookings and unresolved earlier visits appear here.</p></div>
            </div>
          )}
        </section>

        <section className={styles.queueSection} aria-labelledby="pending-title">
          <div className={styles.sectionHeading}>
            <div><p>Oldest request first</p><h2 id="pending-title">Pending approval queue</h2></div>
            <span>{queue.total}</span>
          </div>
          {queue.items.length ? (
            <div className={styles.queueList}>
              {queue.items.map((booking, index) => (
                <article className={styles.queueRow} key={booking.id}>
                  <div className={styles.order} aria-label={`Queue position ${index + 1}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className={styles.requestIdentity}>
                    <span className={styles.status} data-status={booking.status}>{statusLabels[booking.status]}</span>
                    <h3>{booking.resource.name}</h3>
                    <p>{booking.requester.fullName} · {booking.requester.email}</p>
                  </div>
                  <dl className={styles.queueFacts}>
                    <div><dt>Date</dt><dd>{fullDate(booking.date)}</dd></div>
                    <div><dt>Time</dt><dd>{booking.startTime}–{booking.endTime} ICT</dd></div>
                    <div><dt>Location</dt><dd>{booking.resource.buildingCode} · {booking.resource.location}</dd></div>
                  </dl>
                  <Link prefetch={false} className={styles.reviewLink} href={`/staff/bookings/${booking.id}`}>
                    Review request <ArrowRightIcon />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <ShieldCheckIcon />
              <div><h3>Approval queue is clear</h3><p>New requests for approval-required resources will appear here.</p></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function StaffBookingDetail({
  user,
  booking: initialBooking,
  schedule,
}: {
  user: User;
  booking: StaffBooking;
  schedule: StaffResourceSchedule;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [checkInCode, setCheckInCode] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<StaffBookingActionError["code"] | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const outcomeRef = useRef<HTMLHeadingElement>(null);
  const signInHref = `/login?next=${encodeURIComponent(
    getSafeRedirect(`/staff/bookings/${booking.id}`, "/staff"),
  )}`;

  useEffect(() => {
    if (mode === "rejecting") reasonRef.current?.focus();
  }, [mode]);

  async function operate(action: "check-in" | "check-out" | "no-show") {
    if (isSaving) return;
    if (action === "check-in" && !/^\d{6}$/.test(checkInCode)) {
      setError("Enter the six-digit code shown on the student booking.");
      setErrorCode("validation");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setIsSaving(true);
    setError("");
    setErrorCode(null);
    try {
      const updated = action === "check-in"
        ? await confirmStaffCheckIn(booking.id, checkInCode)
        : action === "check-out"
          ? await checkOutStaffBooking(booking.id)
          : await markStaffBookingNoShow(booking.id);
      setBooking(updated);
      requestAnimationFrame(() => outcomeRef.current?.focus());
    } catch (caught) {
      const actionError =
        caught instanceof StaffBookingActionError ? caught : null;
      setError(
        actionError?.message ??
          "This visit update could not be saved. Try again.",
      );
      setErrorCode(actionError?.code ?? "unexpected");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setIsSaving(false);
    }
  }

  async function review(action: "approve" | "reject") {
    if (isSaving) return;
    if (action === "reject" && reason.trim().length < 3) {
      setError("Enter a clear reason with at least 3 characters.");
      reasonRef.current?.focus();
      return;
    }
    setIsSaving(true);
    setError("");
    setErrorCode(null);
    try {
      const updated = action === "approve"
        ? await approveStaffBooking(booking.id)
        : await rejectStaffBooking(booking.id, reason.trim());
      setBooking(updated);
      requestAnimationFrame(() => outcomeRef.current?.focus());
    } catch (caught) {
      const actionError =
        caught instanceof StaffBookingActionError ? caught : null;
      setError(
        actionError?.message ?? "This review could not be saved. Try again.",
      );
      setErrorCode(actionError?.code ?? "unexpected");
      setMode(action === "reject" ? "rejecting" : "idle");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setIsSaving(false);
    }
  }

  const activeSchedule = schedule.bookings
    .map((item) => (item.id === booking.id ? booking : item))
    .filter(
      (item) =>
        (item.status === "pending" && item.canReview) ||
        item.status === "confirmed" ||
        item.status === "checked_in",
    );

  return (
    <main className={styles.page}>
      <StaffHeader user={user} detail />
      <div className={styles.detailShell}>
        <Link prefetch={false} className={styles.backLink} href="/staff">← Back to approval queue</Link>
        <section className={styles.detailHero} aria-labelledby="review-title">
          <div>
            <span className={styles.status} data-status={booking.status}>{statusLabels[booking.status]}</span>
            <p>{booking.resource.code} · Request {booking.id.slice(0, 8).toUpperCase()}</p>
            <h1 id="review-title">{booking.resource.name}</h1>
            <span>{booking.resource.buildingName} · {booking.resource.location}</span>
          </div>
          <div className={styles.heroTime}><CalendarIcon /><strong>{fullDate(booking.date)}</strong><span>{booking.startTime}–{booking.endTime} ICT</span></div>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.requestPanel} aria-labelledby="request-details-title">
            <div className={styles.panelHeading}><StatusIcon /><div><p>Booking request</p><h2 id="request-details-title">Decision context</h2></div></div>
            <dl className={styles.detailFacts}>
              <div><dt>Requested by</dt><dd>{booking.requester.fullName}</dd></div>
              <div><dt>University email</dt><dd>{booking.requester.email}</dd></div>
              <div><dt>Requested at</dt><dd>{requestedAt(booking.createdAt)}</dd></div>
              <div><dt>Resource type</dt><dd>{booking.resource.type}</dd></div>
              <div><dt>Building</dt><dd>{booking.resource.buildingCode} · {booking.resource.buildingName}</dd></div>
              <div><dt>Location</dt><dd>{booking.resource.location}</dd></div>
            </dl>

            <div className={styles.decision} aria-labelledby="decision-title">
              <h2 ref={outcomeRef} tabIndex={-1} id="decision-title">
                {booking.status === "pending"
                  ? booking.canReview
                    ? "Record your decision"
                    : "Approval window ended"
                  : booking.status === "confirmed"
                    ? "Confirm campus arrival"
                    : booking.status === "checked_in"
                      ? "Complete this visit"
                      : `${statusLabels[booking.status]} by staff`}
              </h2>
              {booking.status === "pending" && booking.canReview ? (
                <>
                  <p>Approval confirms the booking. Rejection releases the interval immediately.</p>
                  {mode === "rejecting" ? (
                    <div className={styles.rejectForm}>
                      <label htmlFor="rejection-reason">Reason for rejection</label>
                      <textarea
                        ref={reasonRef}
                        id="rejection-reason"
                        value={reason}
                        maxLength={500}
                        rows={4}
                        onChange={(event) => setReason(event.target.value)}
                        aria-describedby="rejection-help"
                      />
                      <div id="rejection-help"><span>Shared with the student</span><span>{reason.length}/500</span></div>
                      <div className={styles.decisionButtons}>
                        <button type="button" disabled={isSaving} onClick={() => { setMode("idle"); setError(""); setErrorCode(null); }}>Keep pending</button>
                        <button type="button" disabled={isSaving} onClick={() => void review("reject")}>
                          {isSaving ? "Rejecting…" : "Reject request"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.decisionButtons}>
                      <button type="button" disabled={isSaving} onClick={() => setMode("rejecting")}>Reject with reason</button>
                      <button type="button" disabled={isSaving} onClick={() => void review("approve")}>{isSaving ? "Approving…" : "Approve booking"}</button>
                    </div>
                  )}
                </>
              ) : booking.status === "pending" ? (
                <div className={styles.outcome} data-status={booking.status}>
                  <strong>Request remains pending</strong>
                  <span>
                    The scheduled time has ended, so this request can no longer
                    be approved or rejected.
                  </span>
                </div>
              ) : booking.status === "confirmed" ? (
                <>
                  <p>{booking.checkInRequested ? "Enter the six-digit code shown by the student." : "The student has not generated a check-in code yet."}</p>
                  {booking.canConfirmCheckIn && (
                    <div className={styles.checkInForm}>
                      <label htmlFor="staff-check-in-code">Student check-in code</label>
                      <input
                        id="staff-check-in-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={checkInCode}
                        onChange={(event) => setCheckInCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                      />
                      <button type="button" disabled={isSaving} onClick={() => void operate("check-in")}>
                        {isSaving ? "Confirming…" : "Confirm check-in"}
                      </button>
                    </div>
                  )}
                  {booking.canMarkNoShow && (
                    <button className={styles.noShowButton} type="button" disabled={isSaving} onClick={() => void operate("no-show")}>
                      {isSaving ? "Recording…" : "Mark as no-show"}
                    </button>
                  )}
                </>
              ) : booking.status === "checked_in" ? (
                <>
                  <p>Arrival confirmed{booking.checkedInAt ? ` at ${requestedAt(booking.checkedInAt)}` : ""}. Confirm checkout when the resource is returned.</p>
                  <button className={styles.checkOutButton} type="button" disabled={isSaving} onClick={() => void operate("check-out")}>
                    {isSaving ? "Checking out…" : "Confirm check-out"}
                  </button>
                </>
              ) : (
                <div className={styles.outcome} data-status={booking.status}>
                  <strong>{booking.status === "completed" ? "Visit completed" : booking.status === "no_show" ? "No-show recorded" : booking.status === "rejected" ? "Request rejected" : "Booking closed"}</strong>
                  <span>{booking.checkedOutAt ? requestedAt(booking.checkedOutAt) : booking.noShowAt ? requestedAt(booking.noShowAt) : booking.reviewedAt ? requestedAt(booking.reviewedAt) : "Update recorded"}</span>
                  {booking.rejectionReason && <p>{booking.rejectionReason}</p>}
                </div>
              )}
              {error && (
                <div className={styles.errorRecovery}>
                  <p
                    ref={errorRef}
                    tabIndex={-1}
                    className={styles.actionError}
                    role="alert"
                  >
                    {error}
                  </p>
                  {errorCode === "session" ? (
                    <Link href={signInHref}>Sign in again</Link>
                  ) : errorCode === "conflict" || errorCode === "not-found" ? (
                    <button type="button" onClick={() => router.refresh()}>
                      Refresh booking details
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <aside className={styles.schedulePanel} aria-labelledby="schedule-title">
            <div className={styles.panelHeading}><ClockIcon /><div><p>Same resource · Same date</p><h2 id="schedule-title">Resource schedule</h2></div></div>
            <p className={styles.scheduleIntro}>{activeSchedule.length} active interval{activeSchedule.length === 1 ? "" : "s"} on {fullDate(schedule.date)}.</p>
            <div className={styles.scheduleList}>
              {activeSchedule.length ? activeSchedule.map((item) => (
                <div className={styles.scheduleSlot} data-current={item.id === booking.id} key={item.id}>
                  <span>{item.startTime}</span><i aria-hidden="true" /><span>{item.endTime}</span>
                  <div><strong>{item.id === booking.id ? "This request" : item.requester.fullName}</strong><small>{statusLabels[item.status]}</small></div>
                </div>
              )) : <p>No active bookings remain for this resource on this date.</p>}
            </div>
            <div className={styles.scheduleLocation}><MapPinIcon /><span>{booking.resource.buildingName}<small>{booking.resource.location}</small></span></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
