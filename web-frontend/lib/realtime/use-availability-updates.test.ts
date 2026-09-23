import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAvailabilityUpdates } from "./use-availability-updates";
import * as socketModule from "./socket";

describe("useAvailabilityUpdates", () => {
  let mockSocket: {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSocket = {
      connected: true,
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    vi.spyOn(socketModule, "getSocket").mockReturnValue(mockSocket as unknown as ReturnType<typeof socketModule.getSocket>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing if date is undefined", () => {
    renderHook(() => useAvailabilityUpdates("r1", undefined, vi.fn()));
    expect(socketModule.getSocket).not.toHaveBeenCalled();
  });

  it("joins room on mount and leaves on unmount", () => {
    const { unmount } = renderHook(() =>
      useAvailabilityUpdates("r1", "2024-01-01", vi.fn())
    );

    expect(mockSocket.emit).toHaveBeenCalledWith("join:availability", {
      resourceId: "r1",
      date: "2024-01-01",
    });

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith("leave:availability", {
      resourceId: "r1",
      date: "2024-01-01",
    });
  });

  it("calls onUpdate when matching availability:changed event is received", () => {
    const onUpdate = vi.fn();
    renderHook(() => useAvailabilityUpdates("r1", "2024-01-01", onUpdate));

    // Find the registered handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "availability:changed"
    )?.[1] as (payload: { resourceId: string; date: string }) => void;

    // Simulate matching event
    eventHandler({ resourceId: "r1", date: "2024-01-01" });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // Simulate non-matching event
    eventHandler({ resourceId: "r2", date: "2024-01-01" });
    eventHandler({ resourceId: "r1", date: "2024-01-02" });
    expect(onUpdate).toHaveBeenCalledTimes(1); // Still 1
  });

  it("calls onUpdate when matching resource:changed event is received", () => {
    const onUpdate = vi.fn();
    renderHook(() => useAvailabilityUpdates("r1", "2024-01-01", onUpdate));

    const eventHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "resource:changed"
    )?.[1] as (payload: { resourceId: string }) => void;

    // Simulate matching event
    eventHandler({ resourceId: "r1" });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // Simulate non-matching event
    eventHandler({ resourceId: "r2" });
    expect(onUpdate).toHaveBeenCalledTimes(1); // Still 1
  });
});
