import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  updateUserRole,
  updateUserStatus,
  UserMutationError,
} from "../api/browser";
import type { AdminUser } from "../types";
import { AdminUserManager } from "./admin-user-manager";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/browser", () => ({
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
  UserMutationError: class UserMutationError extends Error {
    constructor(public readonly code: string, message: string) { super(message); }
  },
}));

const currentUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Campus Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const adminUser: AdminUser = {
  ...currentUser,
  isActive: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const student: AdminUser = {
  id: "20000000-0000-4000-8000-000000000002",
  email: "student@usth.edu.vn",
  fullName: "Directory Student",
  role: "student",
  isActive: true,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

function renderManager(
  items = [adminUser, student],
  filters: import("../types").AdminUserFilters = { page: 1 },
) {
  return render(
    <AdminUserManager
      currentUser={currentUser}
      directory={{
        items,
        total: items.length,
        page: 1,
        pageSize: 20,
        totalPages: items.length ? 1 : 0,
      }}
      filters={filters}
    />,
  );
}

describe("AdminUserManager", () => {
  beforeEach(() => {
    vi.mocked(updateUserRole).mockReset();
    vi.mocked(updateUserStatus).mockReset();
    refresh.mockReset();
  });

  it("renders directory controls and protects the current administrator", () => {
    renderManager();
    expect(screen.getByRole("heading", { name: "Put the right access in the right hands" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Administrator sections" })).toBeVisible();
    const selfRow = screen.getByText("admin@usth.edu.vn").closest("tr")!;
    expect(within(selfRow).getByRole("combobox", { name: "Role for Campus Admin" })).toBeDisabled();
    expect(within(selfRow).getByRole("button", { name: "Deactivate" })).toBeDisabled();
  });

  it("confirms a role assignment and focuses the outcome", async () => {
    vi.mocked(updateUserRole).mockResolvedValue({ ...student, role: "staff" });
    renderManager();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role for Directory Student" }), "staff");
    expect(screen.getByRole("alertdialog")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Assign Staff role?" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(updateUserRole).toHaveBeenCalledWith(student.id, "staff");
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Directory Student is now staff");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("restores the initiating control when a change is cancelled", async () => {
    renderManager();
    const role = screen.getByRole("combobox", {
      name: "Role for Directory Student",
    });
    await userEvent.selectOptions(role, "staff");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(role).toHaveFocus());
  });

  it("traps keyboard focus inside the confirmation dialog", async () => {
    renderManager();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role for Directory Student" }),
      "staff",
    );
    const keep = screen.getByRole("button", { name: "Keep current access" });
    const confirm = screen.getByRole("button", { name: "Confirm change" });
    confirm.focus();
    await userEvent.tab();
    expect(keep).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("keeps failures in the dialog with explicit recovery", async () => {
    vi.mocked(updateUserStatus).mockRejectedValue(
      new UserMutationError(
        "not-found",
        "This account no longer exists. Refresh the directory.",
      ),
    );
    renderManager();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This account no longer exists",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh user directory" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers a safe sign-in destination when the session expires", async () => {
    vi.mocked(updateUserRole).mockRejectedValue(
      new UserMutationError(
        "session",
        "Your session has ended. Sign in again to manage users.",
      ),
    );
    renderManager();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role for Directory Student" }),
      "staff",
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(await screen.findByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?next=/admin/users",
    );
  });

  it("explains deactivation and records the inactive state", async () => {
    vi.mocked(updateUserStatus).mockResolvedValue({ ...student, isActive: false });
    renderManager();
    await userEvent.click(screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!);
    expect(screen.getByText(/signed out on their next request/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    const studentRow = screen.getByText("student@usth.edu.vn").closest("tr")!;
    expect(within(studentRow).getByText("Inactive")).toBeVisible();
    expect(updateUserStatus).toHaveBeenCalledWith(student.id, false);
  });

  it("removes a successful mutation from a filtered view", async () => {
    vi.mocked(updateUserStatus).mockResolvedValue({
      ...student,
      isActive: false,
    });
    renderManager([student], { page: 1, status: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(
      await screen.findByRole("heading", { name: "No matching accounts" }),
    ).toBeVisible();
    expect(screen.getByText("No accounts")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("provides an actionable empty state", () => {
    renderManager([]);
    expect(screen.getByRole("heading", { name: "No matching accounts" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View all users" })).toHaveAttribute("href", "/admin/users");
  });
});
