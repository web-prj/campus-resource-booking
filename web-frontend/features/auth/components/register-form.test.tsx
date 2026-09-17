import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "../api/browser";
import { RegisterForm } from "./register-form";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("../api/browser", () => ({
  register: vi.fn(),
  RegistrationError: class RegistrationError extends Error {},
}));

const mockedRegister = vi.mocked(register);

async function completeForm() {
  await userEvent.type(screen.getByLabelText("Full name"), "Nam Tran");
  await userEvent.type(screen.getByLabelText("USTH email"), "nam.tran@usth.edu.vn");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
}

describe("RegisterForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    mockedRegister.mockReset();
  });

  it("shows accessible validation errors without submitting", async () => {
    render(<RegisterForm />);

    await userEvent.click(screen.getByRole("button", { name: "Create student account" }));

    expect(screen.getByText("Enter your full name.")).toBeVisible();
    expect(screen.getByText("Enter a valid @usth.edu.vn email address.")).toBeVisible();
    expect(screen.getByText("Password must contain at least 8 characters.")).toBeVisible();
    expect(screen.getByText("Confirm your password.")).toBeVisible();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("focuses the first remaining invalid field", async () => {
    render(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Full name"), "Nam Tran");
    await userEvent.type(screen.getByLabelText("USTH email"), "nam.tran@usth.edu.vn");
    await userEvent.click(screen.getByRole("button", { name: "Create student account" }));

    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("focuses an announced registration failure", async () => {
    mockedRegister.mockRejectedValue(new Error("offline"));
    render(<RegisterForm />);
    await completeForm();

    await userEvent.click(screen.getByRole("button", { name: "Create student account" }));

    expect(await screen.findByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("account could not be created");
  });

  it("rejects mismatched passwords", async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Full name"), "Nam Tran");
    await userEvent.type(screen.getByLabelText("USTH email"), "nam.tran@usth.edu.vn");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password456");
    await userEvent.click(screen.getByRole("button", { name: "Create student account" }));

    expect(screen.getByText("Passwords do not match.")).toBeVisible();
    expect(screen.getByLabelText("Confirm password")).toHaveFocus();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while registration is pending", async () => {
    mockedRegister.mockImplementation(() => new Promise(() => undefined));
    render(<RegisterForm />);
    await completeForm();

    fireEvent.submit(screen.getByRole("button", { name: "Create student account" }).closest("form")!);

    expect(await screen.findByRole("button", { name: "Creating account…" })).toBeDisabled();
    expect(mockedRegister).toHaveBeenCalledTimes(1);
  });

  it("creates the account and navigates to the requested destination", async () => {
    mockedRegister.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "nam.tran@usth.edu.vn",
      fullName: "Nam Tran",
      role: "student",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    render(<RegisterForm redirectTo="/dashboard" />);
    await completeForm();

    await userEvent.click(screen.getByRole("button", { name: "Create student account" }));

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledWith({
        fullName: "Nam Tran",
        email: "nam.tran@usth.edu.vn",
        password: "password123",
      });
      expect(replace).toHaveBeenCalledWith("/dashboard");
      expect(refresh).toHaveBeenCalled();
    });
  });
});
