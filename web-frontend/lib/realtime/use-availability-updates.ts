"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  getSocket,
  isSocketClosedByServer,
  SERVER_DISCONNECT_REASON,
} from "./socket";

interface AvailabilityChangedPayload {
  resourceId: string;
  date: string;
}

interface ResourceChangedPayload {
  resourceId: string;
}

/**
 * Subscribes to real-time availability changes for a specific resource and date.
 * Calls `onUpdate` when the availability changes, allowing the consumer to
 * refresh data (typically via `router.refresh()`).
 */
export function useAvailabilityUpdates(
  resourceId: string,
  date: string | undefined,
  onUpdate: () => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!date) return;

    const socket = getSocket();
    if (isSocketClosedByServer()) return;
    const room = { resourceId, date };

    function handleAvailabilityChanged(payload: AvailabilityChangedPayload) {
      if (payload.resourceId === resourceId && payload.date === date) {
        onUpdateRef.current();
      }
    }

    function handleResourceChanged(payload: ResourceChangedPayload) {
      if (payload.resourceId === resourceId) {
        onUpdateRef.current();
      }
    }

    function joinRoom() {
      socket.emit("join:availability", room);
    }

    function handleReconnect() {
      joinRoom();
      onUpdateRef.current();
    }

    function detach() {
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("availability:changed", handleAvailabilityChanged);
      socket.off("resource:changed", handleResourceChanged);
    }

    // The server closed the socket on purpose (session expired or account
    // deactivated). Stay disconnected instead of re-joining or refreshing.
    function handleDisconnect(reason: Socket.DisconnectReason) {
      if (reason === SERVER_DISCONNECT_REASON) detach();
    }

    // Join the room
    if (socket.connected) {
      joinRoom();
    }
    // Re-join and refresh on reconnect
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("availability:changed", handleAvailabilityChanged);
    socket.on("resource:changed", handleResourceChanged);

    return () => {
      if (socket.connected) socket.emit("leave:availability", room);
      detach();
    };
  }, [resourceId, date]);
}
