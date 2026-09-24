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
import type {
  Building,
  Resource,
  ResourceBookingConflict,
  ResourcePage,
} from "../types";
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
      public readonly conflict: unknown = null,
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

function renderManager(
  resources: Resource[] = [resource],
  overrides: Partial<ResourcePage> = {},
) {
  const total = overrides.total ?? resources.length;
  return render(
    <AdminResourceManager
      user={user}
      page={{
        items: resources,
        total,
        page: 1,
        pageSize: 20,
        totalPages: Math.ceil(total / 20),
        ...overrides,
      }}
      buildings={[building]}
    />,
  );
}

function activeBookingConflict(
  overrides: Partial<ResourceBookingConflict> = {},
): ResourceBookingConflict {
  return {
    code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
    message: "This resource has active bookings that would be affected.",
    conflictCount: 12,
    conflictingBookings: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        date: "2099-01-05",
        startTime: "09:00",
        endTime: "11:00",
        status: "confirmed",
      },
      {
        id: "70000000-0000-4000-8000-000000000002",
        date: "2099-01-06",
        startTime: "13:00",
        endTime: "14:00",
        status: "pending",
      },
    ],
    ...overrides,
  };
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
      expect(screen.getByRole("button", { name: "Save changes" })).toHaveFocus();
      expect(
        within(
          screen.getByRole("table", { name: "Campus resource catalog" }),
        ).getByText("Collaboration Room"),
      ).toBeVisible();
    });
  });

  it("restores save focus when a resource mutation fails", async () => {
    mockedCreate.mockRejectedValue(
      new ResourceMutationError(
        "network",
        "The resource service is unreachable. Check your connection and try again.",
      ),
    );
    renderManager([]);
    await completeCreateForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Create resource" }),
    );

    expect(
      await screen.findByText(/resource service is unreachable/i),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create resource" }),
      ).toHaveFocus(),
    );
  });

  it("loads a resource into the editor and saves changes", async () => {
    mockedUpdate.mockResolvedValue({ ...resource, name: "Updated Room" });
    renderManager();

    const row = screen.getByText("Study Room A101").closest("tr")!;
    expect(
      within(row).getByRole("button", { name: "Edit Study Room A101" }),
    ).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: /^Edit / }));
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
      expect(screen.getByRole("button", { name: "Save changes" })).toHaveFocus();
    });
  });

  it("sends an empty description when an administrator clears it", async () => {
    mockedUpdate.mockResolvedValue({ ...resource, description: null });
    renderManager();

    const row = screen.getByText("Study Room A101").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: /^Edit / }));
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
    await userEvent.click(within(row).getByRole("button", { name: /^Edit / }));
    expect(await screen.findByText("Campus maintenance")).toBeVisible();
    expect(mockedGetClosures).toHaveBeenCalledWith(resource.id);

    fireEvent.change(screen.getByLabelText("Closure date"), {
      target: { value: "2026-09-19" },
    });
    await userEvent.type(screen.getByLabelText("Reason"), "Safety inspection");
    await userEvent.click(screen.getByRole("button", { name: "Add closure" }));
    expect(await screen.findByText("Safety inspection")).toBeVisible();
    expect(screen.getByText("Closure added for 2026-09-19.")).toBeVisible();
    expect(screen.getByLabelText("Closure date")).toHaveFocus();
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

  it("restores closure focus when a closure mutation fails", async () => {
    mockedCreateClosure.mockRejectedValue(
      new ResourceMutationError(
        "network",
        "The resource service is unreachable. Check your connection and try again.",
      ),
    );
    renderManager();
    const row = screen.getByText("Study Room A101").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: /^Edit / }));
    fireEvent.change(screen.getByLabelText("Closure date"), {
      target: { value: "2026-09-19" },
    });
    await userEvent.type(screen.getByLabelText("Reason"), "Safety inspection");

    await userEvent.click(screen.getByRole("button", { name: "Add closure" }));

    expect(
      await screen.findByText(/resource service is unreachable/i),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Closure date")).toHaveFocus(),
    );
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

    const status = screen.getByLabelText("Status for Study Room A101");
    fireEvent.change(status, {
      target: { value: "maintenance" },
    });

    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute("href", "/login?next=%2Fadmin%2Fresources");
    expect(status).toHaveFocus();
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
    expect(screen.getByRole("button", { name: /^Edit / })).toBeDisabled();
    expect(mockedStatus).toHaveBeenCalledWith(resource.id, "maintenance");

    resolveStatus({ ...resource, status: "maintenance" });
    await waitFor(() => {
      expect(status).toBeEnabled();
      expect(status).toHaveFocus();
      expect(
        screen.getByText(
          "Study Room A101 is under maintenance and cannot be booked.",
        ),
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

  it("labels page-level counts and uses the catalog total when paginated", () => {
    renderManager([resource], { total: 45, page: 2, totalPages: 3 });

    const summary = screen.getByLabelText("Admin dashboard summary");
    expect(summary).toHaveTextContent("45Total resources");
    expect(summary).toHaveTextContent("1Active on this page");
    expect(summary).toHaveTextContent("Require approval on this page");

    const nav = screen.getByRole("navigation", {
      name: "Resource catalog pages",
    });
    expect(nav).toHaveTextContent("Page 2 of 3");
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/resources",
    );
    expect(within(nav).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/resources?page=3",
    );
  });

  it("marks the unavailable pagination direction as disabled", () => {
    renderManager([resource], { total: 21, page: 2, totalPages: 2 });
    const nav = screen.getByRole("navigation", {
      name: "Resource catalog pages",
    });
    expect(within(nav).queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
    expect(within(nav).getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not paginate a single-page catalog", () => {
    renderManager();
    expect(
      screen.queryByRole("navigation", { name: "Resource catalog pages" }),
    ).not.toBeInTheDocument();
  });

  it("links administrators to staff approvals from the admin navigation", () => {
    renderManager();
    const nav = screen.getByRole("navigation", {
      name: "Administrator sections",
    });
    expect(within(nav).getByRole("link", { name: "Approvals" })).toHaveAttribute(
      "href",
      "/staff",
    );
    expect(within(nav).getByRole("link", { name: "Resources" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Approvals" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("preserves the catalog page in session recovery", async () => {
    mockedStatus.mockRejectedValue(
      new ResourceMutationError("session", "Your session has ended."),
    );
    renderManager([resource], { total: 30, page: 2, totalPages: 2 });

    fireEvent.change(screen.getByLabelText("Status for Study Room A101"), {
      target: { value: "inactive" },
    });

    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/admin/resources?page=2")}`,
    );
  });

  it("lists active bookings that block a status change", async () => {
    mockedStatus.mockRejectedValue(
      new ResourceMutationError(
        "active-bookings",
        "This resource has active bookings that would be affected.",
        activeBookingConflict(),
      ),
    );
    renderManager();

    fireEvent.change(screen.getByLabelText("Status for Study Room A101"), {
      target: { value: "maintenance" },
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This resource has active bookings that would be affected.",
    );
    expect(alert).toHaveTextContent("12 active bookings");
    expect(alert).toHaveTextContent("Resolve them in staff operations");
    expect(alert).toHaveFocus();
    const links = within(alert).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "/staff/bookings/70000000-0000-4000-8000-000000000001",
    );
    expect(links[0]).toHaveTextContent("09:00–11:00 ICT");
    expect(links[0]).toHaveTextContent("Confirmed");
    expect(links[1]).toHaveTextContent("Pending approval");
    expect(alert).toHaveTextContent("and 10 more bookings are not listed.");
    expect(screen.getByLabelText("Status for Study Room A101")).toHaveValue(
      "active",
    );
  });

  it("shows active-booking conflicts for closures without claiming more bookings", async () => {
    mockedCreateClosure.mockRejectedValue(
      new ResourceMutationError(
        "active-bookings",
        "Bookings exist on this date.",
        activeBookingConflict({
          message: "Bookings exist on this date.",
          conflictCount: 1,
          conflictingBookings: [
            activeBookingConflict().conflictingBookings[0],
          ],
        }),
      ),
    );
    renderManager();
    await userEvent.click(screen.getByRole("button", { name: /^Edit / }));
    await waitFor(() => expect(mockedGetClosures).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Closure date"), {
      target: { value: "2099-01-05" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Electrical work" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add closure" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bookings exist on this date.");
    expect(alert).toHaveTextContent("1 active booking would be affected");
    expect(alert).not.toHaveTextContent("more");
    expect(within(alert).getByRole("link")).toHaveAttribute(
      "href",
      "/staff/bookings/70000000-0000-4000-8000-000000000001",
    );
  });

  it("shows active-booking conflicts when edited operating hours are rejected", async () => {
    mockedUpdate.mockRejectedValue(
      new ResourceMutationError(
        "active-bookings",
        "Bookings fall outside the new hours.",
        activeBookingConflict({ message: "Bookings fall outside the new hours." }),
      ),
    );
    renderManager();
    await userEvent.click(screen.getByRole("button", { name: /^Edit / }));
    fireEvent.change(screen.getByLabelText("Closes at"), {
      target: { value: "10:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bookings fall outside the new hours.");
    expect(within(alert).getAllByRole("link")).toHaveLength(2);
  });
});
