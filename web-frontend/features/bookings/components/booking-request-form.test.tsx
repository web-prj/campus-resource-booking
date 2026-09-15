import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import {
  BookingRequestError,
  createBookingRequest,
} from "../api/browser";
import { BookingRequestForm } from "./booking-request-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("../api/browser", () => ({
  createBookingRequest: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedCreate = vi.mocked(createBookingRequest);
const student: User = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};

function renderForm(user: User = student, requiresApproval = false) {
  return render(
    <BookingRequestForm
      user={user}
      resourceName="Study Room A101"
      requiresApproval={requiresApproval}
      input={input}
    />,
  );
}

describe("BookingRequestForm", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    refresh.mockReset();
  });

  it("shows the selected interval and locks duplicate submission", async () => {
    let resolveBooking!: (value: Awaited<ReturnType<typeof createBookingRequest>>) => void;
    mockedCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBooking = resolve;
        }),
    );
    renderForm();

    expect(screen.getByText("Study Room A101")).toBeVisible();
    expect(screen.getByText("09:00–10:00 ICT (UTC+7)")).toBeVisible();
    expect(screen.getByText("Immediate confirmation")).toBeVisible();
    const button = screen.getByRole("button", { name: "Send booking request" });
    await userEvent.dblClick(button);

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(input, student.id);
    expect(screen.getByRole("button", { name: "Sending request…" })).toBeDisabled();

    resolveBooking({
      id: "40000000-0000-4000-8000-000000000001",
      requesterId: student.id,
      ...input,
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    expect(await screen.findByText("Booking confirmed.")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["confirmed", false, "Booking confirmed."],
    ["pending", true, "Request sent — pending staff approval."],
  ] as const)(
    "announces the backend-returned %s status",
    async (status, requiresApproval, message) => {
      mockedCreate.mockResolvedValue({
        id: "40000000-0000-4000-8000-000000000001",
        requesterId: student.id,
        ...input,
        timeZone: "Asia/Ho_Chi_Minh",
        status,
        createdAt: "2026-09-15T00:00:00.000Z",
      });
      renderForm(student, requiresApproval);

      await userEvent.click(
        screen.getByRole("button", { name: "Send booking request" }),
      );

      expect(await screen.findByText(message)).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Send booking request" }),
      ).not.toBeInTheDocument();
    },
  );

  it("offers safe sign-in recovery when the session expires", async () => {
    mockedCreate.mockRejectedValue(
      new BookingRequestError(
        "session",
        "Your session has ended. Sign in again before sending this request.",
      ),
    );
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?next=%2Fresources%2F20000000-0000-4000-8000-000000000001%3Fdate%3D2099-01-05%26startTime%3D09%253A00%26endTime%3D10%253A00",
    );
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("focuses an actionable conflict and refreshes availability", async () => {
    mockedCreate.mockRejectedValue(
      new BookingRequestError(
        "conflict",
        "This time is no longer bookable. Choose another slot and try again.",
      ),
    );
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("no longer bookable");
    expect(refresh).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh availability" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("keeps staff and admin accounts read-only", () => {
    renderForm({ ...student, role: "staff" });

    expect(
      screen.getByText("Booking requests are available to student accounts."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });
});
