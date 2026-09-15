import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createResource,
  createResourceClosure,
  deleteResourceClosure,
  getResourceClosures,
  ResourceMutationError,
  updateResource,
  updateResourceStatus,
} from "./browser";

const resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: null,
  type: "room" as const,
  status: "active" as const,
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building: {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MAIN",
    name: "Main Academic Building",
    address: "USTH Campus, Hanoi",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const input = {
  code: resource.code,
  name: resource.name,
  description: "",
  type: resource.type,
  capacity: resource.capacity,
  location: resource.location,
  buildingId: resource.building.id,
};

function response(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin resource browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("creates a resource with cookie credentials", async () => {
    const created = { ...resource, amenities: [] };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(created, 201));

    await expect(createResource(input, request)).resolves.toEqual(created);
    expect(request).toHaveBeenCalledWith(
      "http://localhost:18320/api/admin/resources",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(input),
      }),
    );
  });

  it("edits details and changes status through separate endpoints", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(resource))
      .mockResolvedValueOnce(response({ ...resource, status: "maintenance" }));

    await updateResource(resource.id, input, request);
    await updateResourceStatus(resource.id, "maintenance", request);

    expect(request).toHaveBeenNthCalledWith(
      1,
      `http://localhost:18320/api/admin/resources/${resource.id}`,
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      `http://localhost:18320/api/admin/resources/${resource.id}/status`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ status: "maintenance" }),
      }),
    );
  });

  it("lists, creates, and removes scoped resource closures", async () => {
    const closure = {
      id: "40000000-0000-4000-8000-000000000001",
      resourceId: resource.id,
      date: "2026-09-18",
      reason: "Campus maintenance",
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([closure]))
      .mockResolvedValueOnce(response(closure, 201))
      .mockResolvedValueOnce(response(undefined, 204));

    await expect(getResourceClosures(resource.id, request)).resolves.toEqual([
      closure,
    ]);
    await expect(
      createResourceClosure(
        resource.id,
        { date: closure.date, reason: closure.reason },
        request,
      ),
    ).resolves.toEqual(closure);
    await expect(
      deleteResourceClosure(resource.id, closure.id, request),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenNthCalledWith(
      2,
      `http://localhost:18320/api/admin/resources/${resource.id}/closures`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ date: closure.date, reason: closure.reason }),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      `http://localhost:18320/api/admin/resources/${resource.id}/closures/${closure.id}`,
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("rejects closure responses outside the requested resource scope", async () => {
    const otherResourceClosure = {
      id: "40000000-0000-4000-8000-000000000009",
      resourceId: "20000000-0000-4000-8000-000000000002",
      date: "2026-09-18",
      reason: "Campus maintenance",
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([otherResourceClosure]))
      .mockResolvedValueOnce(response(otherResourceClosure, 201));

    await expect(
      getResourceClosures(resource.id, request),
    ).rejects.toMatchObject({ code: "unexpected" });
    await expect(
      createResourceClosure(
        resource.id,
        {
          date: otherResourceClosure.date,
          reason: otherResourceClosure.reason,
        },
        request,
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });

  it("rejects valid resource responses outside the mutation scope", async () => {
    const other = {
      ...resource,
      id: "20000000-0000-4000-8000-000000000002",
    };
    const wrongDetails = { ...resource, name: "Different resource" };

    await expect(
      createResource(
        input,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(response({ ...wrongDetails, amenities: [] }, 201)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
    await expect(
      updateResource(
        resource.id,
        input,
        vi.fn<typeof fetch>().mockResolvedValue(response(other)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
    await expect(
      updateResource(
        resource.id,
        input,
        vi.fn<typeof fetch>().mockResolvedValue(response(wrongDetails)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
    await expect(
      updateResourceStatus(
        resource.id,
        "maintenance",
        vi.fn<typeof fetch>().mockResolvedValue(response(resource)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });

  it("rejects a valid closure response outside the submitted date and reason", async () => {
    const closure = {
      id: "40000000-0000-4000-8000-000000000001",
      resourceId: resource.id,
      date: "2026-09-19",
      reason: "Different reason",
      createdAt: "2026-09-01T00:00:00.000Z",
    };

    await expect(
      createResourceClosure(
        resource.id,
        { date: "2026-09-18", reason: "Campus maintenance" },
        vi.fn<typeof fetch>().mockResolvedValue(response(closure, 201)),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });

  it.each([
    [400, "validation"],
    [401, "session"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [500, "unexpected"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, status));
    await expect(createResource(input, request)).rejects.toMatchObject({
      name: "ResourceMutationError",
      code,
    } satisfies Partial<ResourceMutationError>);
  });

  it("maps network failures and rejects malformed success responses", async () => {
    const offline = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    await expect(createResource(input, offline)).rejects.toMatchObject({
      code: "network",
    });

    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ id: resource.id }));
    await expect(createResource(input, malformed)).rejects.toMatchObject({
      code: "unexpected",
    });
  });
});
