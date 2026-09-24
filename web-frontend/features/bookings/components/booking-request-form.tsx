"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/features/auth/types";
import { createBookingRequest, BookingRequestError } from "../api/browser";
import type { BookingRequestInput, BookingRequestResult } from "../types";

import styles from "./booking-request-form.module.css";

interface BookingRequestFormProps {
  user: User;
  resourceName: string;
  requiresApproval: boolean;
  isSlotAvailable?: boolean;
  /** Where to send the student to pick a different interval. */
  chooseAnotherHref?: string;
  input: BookingRequestInput;
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export function BookingRequestForm({
  user,
  resourceName,
  requiresApproval,
  isSlotAvailable = true,
  chooseAnotherHref,
  input,
}: BookingRequestFormProps) {
  const router = useRouter();
  const lockRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BookingRequestResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<BookingRequestError["code"] | null>(
    null,
  );

  if (user.role !== "student") {
    return (
      <p className={styles.roleNotice}>
        Booking requests are available to student accounts.
      </p>
    );
  }

  async function submit() {
    if (lockRef.current || result) return;
    lockRef.current = true;
    setIsSubmitting(true);
    setError("");
    setErrorCode(null);
    try {
      const created = await createBookingRequest(input, user.id);
      setResult(created);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (caught) {
      const message =
        caught instanceof BookingRequestError
          ? caught.message
          : "The booking request could not be completed. Try again.";
      setError(message);
      setErrorCode(
        caught instanceof BookingRequestError ? caught.code : "unexpected",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      lockRef.current = false;
      setIsSubmitting(false);
    }
  }

  const bookingHref = `/resources/${input.resourceId}?date=${encodeURIComponent(
    input.date,
  )}&startTime=${encodeURIComponent(input.startTime)}&endTime=${encodeURIComponent(
    input.endTime,
  )}`;
  const signInHref = `/login?next=${encodeURIComponent(bookingHref)}`;
  const anotherSlotHref =
    chooseAnotherHref ??
    `/resources/${input.resourceId}?date=${encodeURIComponent(input.date)}`;
  const isUnavailable = !result && !isSlotAvailable;

  return (
    <section
      className={styles.request}
      aria-labelledby="booking-request-title"
      aria-busy={isSubmitting}
    >
      <div className={styles.heading}>
        <div>
          <p>Selected booking interval</p>
          <h3 id="booking-request-title">
            {isUnavailable ? "Selected time unavailable" : "Request this resource"}
          </h3>
        </div>
        {!isUnavailable && (
          <span>
            {result
              ? result.status === "pending"
                ? "Staff approval"
                : "Confirmed"
              : requiresApproval
                ? "Staff approval"
                : "Immediate confirmation"}
          </span>
        )}
      </div>

      <dl className={styles.summary}>
        <div>
          <dt>Resource</dt>
          <dd>{resourceName}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{displayDate(input.date)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{input.startTime}–{input.endTime} ICT (UTC+7)</dd>
        </div>
      </dl>

      {result ? (
        <div
          ref={resultRef}
          className={styles.result}
          data-status={result.status}
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          <strong>
            {result.status === "pending"
              ? "Request sent — pending staff approval."
              : "Booking confirmed."}
          </strong>
          <span>
            {resourceName} · {displayDate(result.date)} · {result.startTime}–{result.endTime} ICT
          </span>
          <Link className={styles.sessionLink} href={`/bookings/${result.id}`}>
            View booking
          </Link>
        </div>
      ) : errorCode === "conflict" || errorCode === "not-found" ? (
        <button type="button" onClick={() => router.refresh()}>
          Refresh availability
        </button>
      ) : errorCode === "session" ? (
        <Link className={styles.sessionLink} href={signInHref}>
          Sign in again
        </Link>
      ) : isUnavailable ? (
        <div className={styles.unavailable} role="status">
          <p>
            <strong>
              {input.startTime}–{input.endTime} is no longer available.
            </strong>{" "}
            It is already booked or the resource is closed at that time. No new
            request was sent.
          </p>
          <Link className={styles.sessionLink} href={anotherSlotHref}>
            Choose another slot
          </Link>
        </div>
      ) : (
        <button type="button" disabled={isSubmitting} onClick={() => void submit()}>
          {isSubmitting ? "Sending request…" : "Send booking request"}
        </button>
      )}

      {error && (
        <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      {!result && !isUnavailable && (
        <small>
          Availability is checked again when you send the request. Selecting a slot does not hold it.
        </small>
      )}
    </section>
  );
}
