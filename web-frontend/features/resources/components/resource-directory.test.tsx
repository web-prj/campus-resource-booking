import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Building, Resource, ResourcePage } from "../types";
import { ResourceDirectory } from "./resource-directory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const building: Building = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "MAIN",
  name: "Main Academic Building",
  address: "USTH Campus, Hanoi",
};

const room: Resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: "A group study room.",
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard", "display", "power outlets", "air conditioning"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const laboratory: Resource = {
  ...room,
  id: "20000000-0000-4000-8000-000000000003",
  code: "LAB-L201",
  name: "Teaching Laboratory L201",
  type: "laboratory",
  capacity: 24,
  location: "Second floor",
  amenities: ["workstations", "projector"],
  requiresApproval: true,
};

const user = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function page(overrides: Partial<ResourcePage> = {}): ResourcePage {
  return {
    items: [room, laboratory],
    total: 10,
    page: 2,
    pageSize: 9,
    totalPages: 3,
    ...overrides,
  };
}

describe("ResourceDirectory", () => {
  it("renders live campus resource facts and populated filters", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{
          q: "study",
          buildingId: building.id,
          type: "room",
          minCapacity: 8,
          amenity: "whiteboard",
          sort: "capacity_desc",
          page: 2,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Find the right place or equipment.",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Resource or location")).toHaveValue("study");
    expect(screen.getByLabelText("Building")).toHaveValue(building.id);
    expect(screen.getByLabelText("Resource type")).toHaveValue("room");
    expect(screen.getByLabelText("Minimum capacity")).toHaveValue(8);
    expect(screen.getByLabelText("Amenity or equipment")).toHaveValue(
      "whiteboard",
    );
    expect(screen.getByLabelText("Sort results")).toHaveValue("capacity_desc");
    expect(
      screen.getByRole("link", { name: "Clear 5 filters" }),
    ).toHaveAttribute("href", "/resources");

    const roomCard = screen.getByText("Study Room A101").closest("article")!;
    expect(within(roomCard).getByText("8")).toBeVisible();
    expect(within(roomCard).getByText("places")).toBeVisible();
    expect(
      within(roomCard).getByText("No staff approval required"),
    ).toBeVisible();
    expect(within(roomCard).getByText("+1 more")).toBeVisible();
    expect(
      within(roomCard).getByRole("link", { name: "View resource details" }),
    ).toHaveAttribute("href", `/resources/${room.id}`);

    const labCard = screen
      .getByText("Teaching Laboratory L201")
      .closest("article")!;
    expect(within(labCard).getByText("Staff approval")).toBeVisible();
  });

  it("requires a complete ordered availability interval with supported bounds", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{}}
      />,
    );

    const date = screen.getByLabelText("Operational date");
    const start = screen.getByLabelText("From");
    const end = screen.getByLabelText("Until");

    expect(within(start).queryByRole("option", { name: "23:00" })).toBeNull();
    expect(within(end).queryByRole("option", { name: "24:00" })).toBeNull();
    expect(within(end).getByRole("option", { name: "23:00" })).toBeVisible();

    fireEvent.change(date, { target: { value: "2026-09-15" } });
    expect(date).toBeRequired();
    expect(start).toBeRequired();
    expect(end).toBeRequired();

    fireEvent.change(start, { target: { value: "22:00" } });
    fireEvent.change(end, { target: { value: "21:00" } });
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect((end as HTMLSelectElement).validationMessage).toBe(
      "Until must be after From.",
    );

    fireEvent.change(end, { target: { value: "23:00" } });
    expect(end).not.toHaveAttribute("aria-invalid");
    expect((end as HTMLSelectElement).validationMessage).toBe("");
  });

  it("resets interval controls when normalized URL filters change", () => {
    const view = render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{
          date: "2026-09-15",
          startTime: "09:00",
          endTime: "11:00",
        }}
      />,
    );

    expect(screen.getByLabelText("Operational date")).toHaveValue(
      "2026-09-15",
    );
    expect(screen.getByLabelText("From")).toHaveValue("09:00");
    expect(screen.getByLabelText("Until")).toHaveValue("11:00");

    view.rerender(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{}}
      />,
    );

    expect(screen.getByLabelText("Operational date")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("Until")).toHaveValue("");
  });

  it("labels interval results as booking-aware", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{}}
      />,
    );

    expect(
      screen.getByText(/pending or confirmed bookings/i),
    ).toBeVisible();
    expect(screen.getByText(/checking operational hours/i)).toBeVisible();
  });

  it("preserves a complete interval in resource detail links", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page({ page: 1 })}
        buildings={[building]}
        filters={{
          date: "2099-01-05",
          startTime: "09:00",
          endTime: "11:00",
        }}
      />,
    );

    const roomCard = screen.getByText("Study Room A101").closest("article")!;
    expect(
      within(roomCard).getByRole("link", { name: "View resource details" }),
    ).toHaveAttribute(
      "href",
      `/resources/${room.id}?date=2099-01-05&startTime=09%3A00&endTime=11%3A00`,
    );
  });

  it("remounts all URL-backed controls from canonical filters", () => {
    const view = render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{ q: "room", type: "room", minCapacity: 8 }}
      />,
    );
    const search = screen.getByLabelText("Resource or location");
    fireEvent.change(search, { target: { value: "dirty value" } });

    view.rerender(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{ q: "lab", type: "laboratory", minCapacity: 20 }}
      />,
    );

    expect(screen.getByLabelText("Resource or location")).toHaveValue("lab");
    expect(screen.getByLabelText("Resource type")).toHaveValue("laboratory");
    expect(screen.getByLabelText("Minimum capacity")).toHaveValue(20);
  });

  it("preserves filters in pagination links", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page()}
        buildings={[building]}
        filters={{ q: "room", type: "room", sort: "capacity_asc", page: 2 }}
      />,
    );

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/resources?q=room&type=room&sort=capacity_asc",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/resources?q=room&type=room&sort=capacity_asc&page=3",
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("gives useful direction when no resources match", () => {
    render(
      <ResourceDirectory
        user={user}
        page={page({ items: [], total: 0, page: 1, totalPages: 0 })}
        buildings={[building]}
        filters={{ amenity: "microscope" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "No active resources match these filters",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View all resources" }),
    ).toHaveAttribute("href", "/resources");
    expect(
      screen.queryByRole("navigation", { name: "Resource pages" }),
    ).not.toBeInTheDocument();
  });
});
