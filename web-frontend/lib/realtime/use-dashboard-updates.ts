"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "./socket";

/**
 * Subscribes to real-time availability changes for the dashboard view.
 * Listens for any availability changes on the given date.
 */
export function useDashboardUpdates(
  date: string,
  onUpdate: () => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const socket = getSocket();

    function handleChange() {
      onUpdateRef.current();
    }

    function joinRoom() {
      socket.emit("join:dashboard", { date });
    }

    function handleReconnect() {
      joinRoom();
      handleChange();
    }

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", handleReconnect);
    socket.on("availability:changed", handleChange);
    socket.on("resource:changed", handleChange);

    return () => {
      socket.emit("leave:dashboard", { date });
      socket.off("connect", handleReconnect);
      socket.off("availability:changed", handleChange);
      socket.off("resource:changed", handleChange);
    };
  }, [date]);
}
