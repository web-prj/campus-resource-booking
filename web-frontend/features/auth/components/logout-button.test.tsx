import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectSocket } from "@/lib/realtime/socket";
import { logout } from "../api/browser";
import { LogoutButton } from "./logout-button";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("../api/browser", () => ({ logout: vi.fn() }));
vi.mock("@/lib/realtime/socket", () => ({ disconnectSocket: vi.fn() }));

const mockedLogout = vi.mocked(logout);
const mockedDisconnect = vi.mocked(disconnectSocket);

describe("LogoutButton", () => {
  beforeEach(() => {
    mockedLogout.mockReset();
    mockedDisconnect.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("closes the realtime socket after signing out and before navigating", async () => {
    const order: string[] = [];
    mockedLogout.mockImplementation(async () => {
      order.push("logout");
    });
    mockedDisconnect.mockImplementation(() => {
      order.push("disconnect");
    });
    replace.mockImplementation(() => {
      order.push("navigate");
    });
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(order).toEqual(["logout", "disconnect", "navigate"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the socket and shows an error when sign-out fails", async () => {
    mockedLogout.mockRejectedValue(new Error("offline"));
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out could not be completed. Try again.",
    );
    expect(mockedDisconnect).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
