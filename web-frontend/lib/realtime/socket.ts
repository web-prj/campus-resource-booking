import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/api/config";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Replace /api suffix with /ws namespace
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace(/\/api\/?$/, "");
    socket = io(`${baseUrl}/ws`, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
