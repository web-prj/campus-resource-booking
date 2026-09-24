"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  getSocket,
  isSocketClosedByServer,
  SERVER_DISCONNECT_REASON,
} from "./socket";

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
    if (isSocketClosedByServer()) return;

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

    function detach() {
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("availability:changed", handleChange);
      socket.off("resource:changed", handleChange);
    }

    // The server closed the socket on purpose (session expired or account
    // deactivated). Stay disconnected instead of re-joining or refreshing.
    function handleDisconnect(reason: Socket.DisconnectReason) {
      if (reason === SERVER_DISCONNECT_REASON) detach();
    }

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("availability:changed", handleChange);
    socket.on("resource:changed", handleChange);

    return () => {
      if (socket.connected) socket.emit("leave:dashboard", { date });
      detach();
    };
  }, [date]);
}
