import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/api/config";

/**
 * Socket.IO reports this reason when the server closed the connection on
 * purpose, for example because the session expired or the account was
 * deactivated. The client must not keep retrying in that case.
 */
export const SERVER_DISCONNECT_REASON = "io server disconnect";

let socket: Socket | null = null;
let closedByServer = false;

function handleDisconnect(reason: Socket.DisconnectReason): void {
  if (reason === SERVER_DISCONNECT_REASON) closedByServer = true;
}

export function getSocket(): Socket {
  if (!socket) {
    // Replace /api suffix with /ws namespace
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace(/\/api\/?$/, "");
    closedByServer = false;
    socket = io(`${baseUrl}/ws`, {
      withCredentials: true,
      autoConnect: true,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
    });
    socket.on("disconnect", handleDisconnect);
  }
  return socket;
}

/** True when the server deliberately closed the current realtime socket. */
export function isSocketClosedByServer(): boolean {
  return closedByServer;
}

/**
 * Closes the realtime connection and forgets it, so the next `getSocket()`
 * call opens a fresh connection with the current session cookie.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.off("disconnect", handleDisconnect);
    socket.disconnect();
    socket = null;
  }
  closedByServer = false;
}
