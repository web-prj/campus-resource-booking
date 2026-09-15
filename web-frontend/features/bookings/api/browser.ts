import { ApiError, browserRequest } from "@/lib/api/browser-client";
import { parseBookingRequestResult } from "../schema";
import type { BookingRequestInput, BookingRequestResult } from "../types";

export type BookingRequestErrorCode =
  | "validation"
  | "session"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "rate-limit"
  | "network"
  | "unexpected";

export class BookingRequestError extends Error {
  constructor(public readonly code: BookingRequestErrorCode, message: string) {
    super(message);
    this.name = "BookingRequestError";
  }
}

function mapError(error: unknown): BookingRequestError {
  if (error instanceof BookingRequestError) return error;
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return new BookingRequestError(
        "network",
        "The booking service is unreachable. Check your connection and try again.",
      );
    }
    const code: BookingRequestErrorCode =
      error.status === 400
        ? "validation"
        : error.status === 401
          ? "session"
          : error.status === 403
            ? "forbidden"
            : error.status === 404
              ? "not-found"
              : error.status === 409
                ? "conflict"
                : error.status === 429
                  ? "rate-limit"
                  : "unexpected";
    const messages: Record<BookingRequestErrorCode, string> = {
      validation: "This booking interval is invalid or is no longer in the future.",
      session: "Your session has ended. Sign in again before sending this request.",
      forbidden: "Booking requests are available to student accounts.",
      "not-found": "This resource is no longer available.",
      conflict: "This time is no longer bookable. Choose another slot and try again.",
      "rate-limit": "Too many requests were sent. Wait a moment and try again.",
      network:
        "The booking service is unreachable. Check your connection and try again.",
      unexpected: "The booking request could not be completed. Try again.",
    };
    return new BookingRequestError(code, messages[code]);
  }
  return new BookingRequestError(
    "unexpected",
    "The booking request could not be completed. Try again.",
  );
}

export async function createBookingRequest(
  input: BookingRequestInput,
  requesterId: string,
  request: typeof fetch = fetch,
): Promise<BookingRequestResult> {
  try {
    const result = parseBookingRequestResult(
      await browserRequest(
        "/bookings",
        { method: "POST", body: JSON.stringify(input) },
        request,
      ),
      input,
      requesterId,
    );
    if (!result) {
      throw new BookingRequestError(
        "unexpected",
        "The booking service returned invalid booking data.",
      );
    }
    return result;
  } catch (error) {
    throw mapError(error);
  }
}
