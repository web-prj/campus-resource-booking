"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "./socket";

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

    // Join the room
    if (socket.connected) {
      joinRoom();
    }
    // Re-join and refresh on reconnect
    socket.on("connect", handleReconnect);
    socket.on("availability:changed", handleAvailabilityChanged);
    socket.on("resource:changed", handleResourceChanged);

    return () => {
      socket.emit("leave:availability", room);
      socket.off("connect", handleReconnect);
      socket.off("availability:changed", handleAvailabilityChanged);
      socket.off("resource:changed", handleResourceChanged);
    };
  }, [resourceId, date]);
}
