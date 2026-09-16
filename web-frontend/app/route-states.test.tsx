import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./error";
import Loading from "./loading";
import NotFound from "./not-found";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

describe("shared route states", () => {
  it("announces that live campus data is loading without implying a mutation", () => {
    render(<Loading />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { name: "Preparing your workspace" })).toBeVisible();
    expect(screen.getByText(/Nothing is being changed/)).toBeVisible();
  });

  it("offers a user-controlled retry when server data cannot load", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("private backend detail")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your bookings and account have not been changed");
    expect(screen.queryByText("private backend detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("provides safe destinations when a record is unavailable", () => {
    render(<NotFound />);
    expect(screen.getByRole("status")).toHaveTextContent("record may belong to another account");
    expect(screen.getByRole("link", { name: "Browse active resources" })).toHaveAttribute("href", "/resources");
  });
});
