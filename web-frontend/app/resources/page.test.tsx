import { beforeEach, describe, expect, it, vi } from "vitest";
import ResourcesPage from "./page";
import { getCurrentUser } from "@/features/auth/api/server";
import { getResourceDirectory } from "@/features/resources/api/server";
import { redirect } from "next/navigation";

vi.mock("@/features/auth/api/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/resources/api/server", () => ({
  getResourceDirectory: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const student = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Discovery Student",
  role: "student" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const buildings = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MAIN",
    name: "Main Academic Building",
    address: "USTH Campus, Hanoi",
  },
];

function directory(page = 1, totalPages = 1) {
  return {
    page: {
      items: [],
      total: totalPages,
      page,
      pageSize: 9,
      totalPages,
    },
    buildings,
  };
}

describe("ResourcesPage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getResourceDirectory).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects anonymous visitors to the safe directory login destination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(
      ResourcesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(`redirect:/login?next=${encodeURIComponent("/resources")}`);
    expect(getResourceDirectory).not.toHaveBeenCalled();
  });

  it("normalizes filters and passes authoritative discovery data to the directory", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDirectory).mockResolvedValue(directory());

    const page = await ResourcesPage({
      searchParams: Promise.resolve({
        q: "  projector  ",
        type: "equipment",
        amenity: " HDMI-Cable ",
        page: "1",
        unknown: "ignored",
      }),
    });

    const filters = {
      q: "projector",
      type: "equipment" as const,
      amenity: "hdmi-cable",
      page: 1,
    };
    expect(getResourceDirectory).toHaveBeenCalledWith(filters);
    expect(page.props).toEqual({ user: student, filters, ...directory() });
  });

  it("redirects an out-of-range page to the last authoritative page while preserving filters", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(getResourceDirectory).mockResolvedValue(directory(99, 2));

    await expect(
      ResourcesPage({
        searchParams: Promise.resolve({
          q: "study room",
          type: "room",
          sort: "capacity_desc",
          page: "99",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/resources?q=study+room&type=room&sort=capacity_desc&page=2",
    );
  });
});
