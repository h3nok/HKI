/**
 * useWebSocket — Resilient WebSocket connection with exponential backoff
 *
 * Enterprise features:
 *  ✅ Automatic reconnection with exponential backoff (1s → 2s → 4s → … → 30s cap)
 *  ✅ Clean teardown on unmount or conversation switch
 *  ✅ Proper URL encoding of query parameters
 *  ✅ Connection-state tracking for UI indicators
 *  ✅ Stale-closure-safe via refs
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

/** Max reconnect delay in ms */
const MAX_BACKOFF_MS = 30_000;
/** Base reconnect delay in ms */
const BASE_BACKOFF_MS = 1_000;
/** Max consecutive reconnect attempts before giving up */
const MAX_RETRIES = 12;

export function useWebSocket(conversationId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // Only need user ID as a gate — avoid depending on the full object reference
  // which changes on every React Query refetch and causes reconnection loops.
  const { data: user } = trpc.auth.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const userId = user?.id;

  /** Build WebSocket URL with proper encoding */
  const buildWsUrl = useCallback((convId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws?conversationId=${encodeURIComponent(convId)}`;
  }, []);

  /** Connect (or reconnect) the WebSocket */
  const connect = useCallback(
    (convId: string) => {
      // Don't reconnect if component has unmounted
      if (unmountedRef.current) return;

      // Close any existing socket before reconnecting
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent triggering reconnect from this close
        socketRef.current.close();
        socketRef.current = null;
      }

      const wsUrl = buildWsUrl(convId);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        const wasReconnect = retriesRef.current > 0;
        if (import.meta.env.DEV)
          console.log(
            "[WebSocket]",
            wasReconnect ? "Reconnected" : "Connected"
          );
        setIsConnected(true);
        retriesRef.current = 0; // Reset backoff on successful connection

        // Fix #7: Emit synthetic reconnect event so streaming state can recover
        if (wasReconnect) {
          setLastMessage({ type: "reconnected", eventType: "system" });
        }
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (err) {
          console.error("[WebSocket] Parse error:", err);
        }
      };

      ws.onclose = event => {
        if (unmountedRef.current) return;
        if (import.meta.env.DEV)
          console.log("[WebSocket] Disconnected", event.code, event.reason);
        setIsConnected(false);
        socketRef.current = null;

        // Don't reconnect on intentional close (code 1000) or if max retries exceeded
        if (event.code === 1000 || retriesRef.current >= MAX_RETRIES) return;

        // Exponential backoff: 1s, 2s, 4s, 8s, … capped at MAX_BACKOFF_MS
        const delay = Math.min(
          BASE_BACKOFF_MS * Math.pow(2, retriesRef.current),
          MAX_BACKOFF_MS
        );
        retriesRef.current += 1;
        if (import.meta.env.DEV)
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${retriesRef.current}/${MAX_RETRIES})`
          );

        reconnectTimerRef.current = setTimeout(() => {
          connect(convId);
        }, delay);
      };

      ws.onerror = error => {
        console.error("[WebSocket] Error:", error);
        // onclose will fire after onerror — reconnection handled there
      };
    },
    [buildWsUrl]
  );

  useEffect(() => {
    unmountedRef.current = false;

    if (!conversationId || !userId) return;

    // Reset retry counter on conversation switch
    retriesRef.current = 0;
    connect(conversationId);

    return () => {
      unmountedRef.current = true;

      // Clear any pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Close the socket cleanly (code 1000 = intentional)
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect on cleanup close
        socketRef.current.close(1000, "Component unmount");
        socketRef.current = null;
      }

      setIsConnected(false);
    };
  }, [conversationId, userId, connect]);

  /** Send a message to the server via WebSocket */
  const sendWsMessage = useCallback((message: Record<string, unknown>) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, lastMessage, sendWsMessage };
}
