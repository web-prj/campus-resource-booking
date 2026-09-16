import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createResource,
  createResourceClosure,
  deleteResourceClosure,
  getResourceClosures,
  ResourceMutationError,
  updateResource,
  updateResourceStatus,
} from "../api/browser";
import type { Building, Resource } from "../types";
import { AdminResourceManager } from "./admin-resource-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../api/browser", () => ({
  createResource: vi.fn(),
  createResourceClosure: vi.fn(),
  deleteResourceClosure: vi.fn(),
  getResourceClosures: vi.fn(),
  updateResource: vi.fn(),
  updateResourceStatus: vi.fn(),
  ResourceMutationError: class ResourceMutationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedCreate = vi.mocked(createResource);
const mockedCreateClosure = vi.mocked(createResourceClosure);
const mockedDeleteClosure = vi.mocked(deleteResourceClosure);
const mockedGetClosures = vi.mocked(getResourceClosures);
const mockedUpdate = vi.mocked(updateResource);
const mockedStatus = vi.mocked(updateResourceStatus);

const building: Building = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "MAIN",
  name: "Main Academic Building",
  address: "USTH Campus, Hanoi",
};

const resource: Resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: "A group study room.",
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const user = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Campus Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderManager(resources: Resource[] = [resource]) {
  return render(
    <AdminResourceManager
      user={user}
      resources={resources}
      buildings={[building]}
    />,
  );
}

function completeCreateForm() {
  fireEvent.change(screen.getByLabelText("Code"), {
    target: { value: "room-a103" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Collaboration Room" },
  });
  fireEvent.change(screen.getByLabelText("Location"), {
    target: { value: "Ground floor" },
  });
  fireEvent.change(screen.getByLabelText("Capacity"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Amenities"), {
    target: { value: "Whiteboard, Display" },
  });
}

describe("AdminResourceManager", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedCreateClosure.mockReset();
    mockedDeleteClosure.mockReset();
    mockedGetClosures.mockReset();
    mockedGetClosures.mockResolvedValue([]);
    mockedUpdate.mockReset();
    mockedStatus.mockReset();
  });

  it("shows live admin dashboard summaries", () => {
    const maintenance: Resource = {
      ...resource,
      id: "20000000-0000-4000-8000-000000000002",
      name: "Laboratory L201",
      type: "laboratory",
      status: "maintenance",
      requiresApproval: true,
      building: {
        ...building,
        id: "10000000-0000-4000-8000-000000000002",
        code: "LAB",
        name: "Laboratory Building",
      },
    };
    const inactive: Resource = {
      ...resource,
      id: "20000000-0000-4000-8000-000000000003",
      name: "Projector Kit",
      type: "equipment",
      status: "inactive",
      requiresApproval: true,
    };

    renderManager([resource, maintenance, inactive]);

    const summary = screen.getByLabelText("Admin dashboard summary");
    expect(summary).toHaveTextContent("3Total resources");
    expect(summary).toHaveTextContent("1Active");
    expect(summary).toHaveTextContent("1In maintenance");
    expect(summary).toHaveTextContent("1Inactive");
    expect(summary).toHaveTextContent("2Require approval");
    expect(summary).toHaveTextContent("2Buildings represented");
  });

  it("shows the catalog and accessible validation messages", async () => {
    renderManager();
    expect(
      screen.getByRole("heading", { name: "Manage bookable resources" }),
    ).toBeVisible();
    expect(screen.getByText("Study Room A101")).toBeVisible();
    expect(screen.getByText("No approval")).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "Scrollable campus resource catalog",
      }),
    ).toHaveAttribute("tabindex", "0");

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );
    const code = screen.getByLabelText("Code");
    const codeError = screen.getByText(
      "Use 2–30 letters, numbers, and single hyphens.",
    );
    expect(codeError).toBeVisible();
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAttribute("aria-describedby", codeError.id);
    await waitFor(() => expect(code).toHaveFocus());
    expect(screen.getByText("Enter a resource name.")).toBeVisible();
    expect(screen.getByText("Enter a location.")).toBeVisible();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("creates a resource and adds it to the catalog", async () => {
    const created = {
      ...resource,
      id: "20000000-0000-4000-8000-000000000003",
      code: "ROOM-A103",
      name: "Collaboration Room",
      capacity: 10,
      location: "Ground floor",
      amenities: ["whiteboard", "display"],
    };
    mockedCreate.mockResolvedValue(created);
    renderManager([]);
    await completeCreateForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "room-a103",
          name: "Collaboration Room",
          capacity: 10,
          amenities: ["Whiteboard", "Display"],
          buildingId: building.id,
        }),
      );
      expect(screen.getByText("Resource created.")).toBeVisible();
      expect(
        within(
          screen.getByRole("table", { name: "Campus resource catalog" }),
        ).getByText("Collaboration Room"),
      ).toBeVisible();
    });
  });

  it("loads a resource into the editor and saves changes", async () => {
    mockedUpdate.mockResolvedValue({ ...resource, name: "Updated Room" });
    renderManager();

    const row = screen.getByText("Study Room A101").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("complementary")).toHaveFocus(),
    );
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Updated Room");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        resource.id,
        expect.objectContaining({ name: "Updated Room" }),
      );
      expect(screen.getByText("Resource changes saved.")).toBeVisible();
    });
  });

  it("sends an empty description when an administrator clears it", async () => {
    mockedUpdate.mockResolvedValue({ ...resource, description: null });
    renderManager();

    const row = screen.getByText("Study Room A101").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        resource.id,
        expect.objectContaining({ description: "" }),
      ),
    );
  });

  it.each([
    [
      Array.from({ length: 21 }, (_, index) => `amenity-${index}`).join(","),
      "Enter no more than 20 amenities.",
    ],
    ["x".repeat(51), "Each amenity must be 50 characters or fewer."],
    ["Whiteboard, whiteboard", "Remove duplicate amenities."],
  ])("validates amenity limits before submission", async (value, message) => {
    renderManager([]);
    await completeCreateForm();
    const amenities = screen.getByLabelText("Amenities");
    fireEvent.change(amenities, { target: { value } });

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );

    const error = screen.getByText(message);
    expect(error).toBeVisible();
    expect(amenities).toHaveAttribute("aria-invalid", "true");
    expect(amenities.getAttribute("aria-describedby")).toContain(error.id);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("loads, creates, and removes scoped closure dates", async () => {
    const closure = {
      id: "40000000-0000-4000-8000-000000000001",
      resourceId: resource.id,
      date: "2026-09-18",
      reason: "Campus maintenance",
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    mockedGetClosures.mockResolvedValue([closure]);
    mockedCreateClosure.mockResolvedValue({
      ...closure,
      id: "40000000-0000-4000-8000-000000000002",
      date: "2026-09-19",
      reason: "Safety inspection",
    });
    mockedDeleteClosure.mockResolvedValue();
    renderManager();

    const row = screen.getByText("Study Room A101").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    expect(await screen.findByText("Campus maintenance")).toBeVisible();
    expect(mockedGetClosures).toHaveBeenCalledWith(resource.id);

    fireEvent.change(screen.getByLabelText("Closure date"), {
      target: { value: "2026-09-19" },
    });
    await userEvent.type(screen.getByLabelText("Reason"), "Safety inspection");
    await userEvent.click(screen.getByRole("button", { name: "Add closure" }));
    expect(await screen.findByText("Safety inspection")).toBeVisible();
    expect(screen.getByText("Closure added for 2026-09-19.")).toBeVisible();
    expect(mockedCreateClosure).toHaveBeenCalledWith(resource.id, {
      date: "2026-09-19",
      reason: "Safety inspection",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Remove closure on 2026-09-18" }),
    );
    await waitFor(() => {
      expect(screen.queryByText("Campus maintenance")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Closure date")).toHaveFocus();
    });
    expect(screen.getByText("Closure removed for 2026-09-18.")).toBeVisible();
    expect(mockedDeleteClosure).toHaveBeenCalledWith(resource.id, closure.id);
  });

  it("focuses the operating-day group when every day is cleared", async () => {
    renderManager([]);
    await completeCreateForm();

    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await userEvent.click(screen.getByLabelText(day));
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );

    const group = screen.getByRole("group", { name: "Operating days" });
    const error = screen.getByText("Select at least one operating day.");
    await waitFor(() => expect(group).toHaveFocus());
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-describedby", error.id);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("associates operating-hour errors with the focused field", async () => {
    renderManager([]);
    await completeCreateForm();
    fireEvent.change(screen.getByLabelText("Closes at"), {
      target: { value: "08:00" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );

    const closesAt = screen.getByLabelText("Closes at");
    const error = screen.getByText("Closing time must be after opening time.");
    await waitFor(() => expect(closesAt).toHaveFocus());
    expect(closesAt).toHaveAttribute("aria-invalid", "true");
    expect(closesAt).toHaveAttribute("aria-describedby", error.id);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("offers sign-in recovery when the admin session expires", async () => {
    mockedStatus.mockRejectedValue(
      new ResourceMutationError(
        "session",
        "Your session has ended. Sign in again to manage resources.",
      ),
    );
    renderManager();

    fireEvent.change(screen.getByLabelText("Status for Study Room A101"), {
      target: { value: "maintenance" },
    });

    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute("href", "/login?next=/admin/resources");
    expect(screen.getByText(/Your session has ended/)).toBeVisible();
  });

  it("changes status and prevents another status action while pending", async () => {
    let resolveStatus!: (value: Resource) => void;
    mockedStatus.mockImplementation(
      () =>
        new Promise<Resource>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    renderManager();

    const status = screen.getByLabelText("Status for Study Room A101");
    fireEvent.change(status, { target: { value: "maintenance" } });
    expect(status).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create resource" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(mockedStatus).toHaveBeenCalledWith(resource.id, "maintenance");

    resolveStatus({ ...resource, status: "maintenance" });
    await waitFor(() => {
      expect(status).toBeEnabled();
      expect(
        screen.getByText("Study Room A101 is now maintenance."),
      ).toBeVisible();
    });
  });

  it("blocks a status mutation while a detail save is pending", async () => {
    let resolveCreate!: (value: Resource) => void;
    mockedCreate.mockImplementation(
      () =>
        new Promise<Resource>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    renderManager();
    await completeCreateForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );
    const status = screen.getByLabelText("Status for Study Room A101");
    expect(status).toBeDisabled();
    fireEvent.change(status, { target: { value: "maintenance" } });
    expect(mockedStatus).not.toHaveBeenCalled();

    resolveCreate({
      ...resource,
      id: "20000000-0000-4000-8000-000000000003",
      code: "ROOM-A103",
      name: "Collaboration Room",
    });
    await waitFor(() => expect(status).toBeEnabled());
  });
});
