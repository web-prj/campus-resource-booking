import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardUpdates } from "./use-dashboard-updates";
import * as socketModule from "./socket";

describe("useDashboardUpdates", () => {
  let mockSocket: {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };

  function handler(event: string) {
    return mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === event,
    )?.[1] as (...args: unknown[]) => void;
  }

  beforeEach(() => {
    mockSocket = { connected: true, emit: vi.fn(), on: vi.fn(), off: vi.fn() };
    vi.spyOn(socketModule, "getSocket").mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketModule.getSocket>,
    );
    vi.spyOn(socketModule, "isSocketClosedByServer").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("joins the dashboard room and refreshes on changes", () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useDashboardUpdates("2099-01-05", onUpdate));

    expect(mockSocket.emit).toHaveBeenCalledWith("join:dashboard", { date: "2099-01-05" });
    handler("availability:changed")({ resourceId: "r1", date: "2099-01-05" });
    expect(onUpdate).toHaveBeenCalledOnce();

    unmount();
    expect(mockSocket.emit).toHaveBeenCalledWith("leave:dashboard", { date: "2099-01-05" });
  });

  it("stays disconnected after the server closes the socket", () => {
    const onUpdate = vi.fn();
    renderHook(() => useDashboardUpdates("2099-01-05", onUpdate));

    handler("disconnect")("io server disconnect");

    const removed = mockSocket.off.mock.calls.map((call: unknown[]) => call[0]);
    expect(removed).toEqual(
      expect.arrayContaining(["connect", "disconnect", "availability:changed", "resource:changed"]),
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("skips a socket the server already closed", () => {
    vi.mocked(socketModule.isSocketClosedByServer).mockReturnValue(true);
    renderHook(() => useDashboardUpdates("2099-01-05", vi.fn()));
    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
