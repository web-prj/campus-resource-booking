import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { login } from "../api/browser";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../api/browser", () => ({
  login: vi.fn(),
  LoginError: class LoginError extends Error {},
}));

const mockedLogin = vi.mocked(login);

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    mockedLogin.mockReset();
  });

  it("shows accessible field errors without submitting invalid input", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in securely" }));

    expect(screen.getByText("Enter a valid @usth.edu.vn email address.")).toBeVisible();
    expect(screen.getByText("Enter your password.")).toBeVisible();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("disables duplicate submission while login is pending", async () => {
    mockedLogin.mockImplementation(() => new Promise(() => undefined));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("USTH email"), "nam.tran@usth.edu.vn");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: "Sign in securely" }).closest("form")!);

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(mockedLogin).toHaveBeenCalledTimes(1);
  });

  it("navigates to the safe destination after login", async () => {
    mockedLogin.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "nam.tran@usth.edu.vn",
      fullName: "Nam Tran",
      role: "student",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    render(<LoginForm redirectTo="/welcome" />);

    await userEvent.type(screen.getByLabelText("USTH email"), "nam.tran@usth.edu.vn");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in securely" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/welcome"));
  });
});
