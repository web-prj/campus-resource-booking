import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import {
  disconnectSocket,
  getSocket,
  isSocketClosedByServer,
  SERVER_DISCONNECT_REASON,
} from "./socket";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

type Handler = (...args: unknown[]) => void;

function fakeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    handlers,
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)?.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
    }),
    emitLocal(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((handler) => handler(...args));
    },
  };
}

describe("realtime socket singleton", () => {
  let sockets: ReturnType<typeof fakeSocket>[];

  beforeEach(() => {
    sockets = [];
    vi.mocked(io).mockImplementation((() => {
      const socket = fakeSocket();
      sockets.push(socket);
      return socket;
    }) as unknown as typeof io);
  });

  afterEach(() => {
    disconnectSocket();
    vi.mocked(io).mockReset();
  });

  it("reuses one credentialed socket for the /ws namespace", () => {
    const first = getSocket();
    const second = getSocket();

    expect(first).toBe(second);
    expect(io).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledWith(
      "http://localhost:18320/ws",
      expect.objectContaining({ withCredentials: true, forceNew: true }),
    );
  });

  it("disconnects and creates a fresh socket after logout", () => {
    const first = getSocket();
    disconnectSocket();

    expect(sockets[0].disconnect).toHaveBeenCalledOnce();
    const second = getSocket();
    expect(second).not.toBe(first);
    expect(io).toHaveBeenCalledTimes(2);
  });

  it("is safe to disconnect when no socket exists", () => {
    expect(() => disconnectSocket()).not.toThrow();
    expect(io).not.toHaveBeenCalled();
  });

  it("remembers when the server closed the socket and resets on disconnect", () => {
    getSocket();
    sockets[0].emitLocal("disconnect", "transport close");
    expect(isSocketClosedByServer()).toBe(false);

    sockets[0].emitLocal("disconnect", SERVER_DISCONNECT_REASON);
    expect(isSocketClosedByServer()).toBe(true);
    expect(getSocket()).toBe(sockets[0]);
    expect(io).toHaveBeenCalledOnce();

    disconnectSocket();
    expect(isSocketClosedByServer()).toBe(false);
    getSocket();
    expect(io).toHaveBeenCalledTimes(2);
    expect(isSocketClosedByServer()).toBe(false);
  });
});
